"""Control plane HTTP routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from controlplane.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_runner,
    verify_password,
)
from controlplane.db import get_db
from controlplane.models import (
    Agent,
    AgentVersion,
    Approval,
    AuditEvent,
    CapabilityGrant,
    Deployment,
    Evaluation,
    Organization,
    Policy,
    Run,
    RunEvent,
    User,
)
from controlplane.policy import evaluate_policy, seed_demo_policies
from controlplane.enforcement import (
    FORGED_EXECUTION_EVENT_TYPES,
    TERMINAL_RUN_STATUSES,
    PermitError,
    canonical_resource,
    consume_capability_token,
    mint_capability_permit,
    revoke_run_capability_grants,
    validate_capability_for_execute,
)
from controlplane.schemas import (
    ApprovalDecision,
    CapabilityCheckRequest,
    CreateRunRequest,
    DeployRequest,
    EvaluateRequest,
    EventIngest,
    LoginRequest,
    PolicyUpsert,
    RegisterAgentRequest,
    RegisterOrgRequest,
    RollbackRequest,
    TokenResponse,
    ToolGateRequest,
    ToolGateResponse,
    ToolResultRequest,
)
from protocol import AgentContract, PolicyEffect

router = APIRouter()


def _audit(db: Session, org_id: str, actor: str, action: str, target_type: str, target_id: str, details: dict | None = None) -> None:
    db.add(
        AuditEvent(
            organization_id=org_id,
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        )
    )


# ── Auth / org ──────────────────────────────────────────────────────────────


@router.post("/auth/register", response_model=TokenResponse)
def register_org(body: RegisterOrgRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if db.query(Organization).filter_by(name=body.organization).first():
        raise HTTPException(400, "Organization already exists")
    org = Organization(name=body.organization)
    db.add(org)
    db.flush()
    user = User(
        organization_id=org.id,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, org.id, {"email": user.email})
    return TokenResponse(access_token=token, organization=org.name, user_id=user.id)


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    org = db.query(Organization).filter_by(name=body.organization).first()
    if not org:
        raise HTTPException(401, "Invalid credentials")
    user = db.query(User).filter_by(organization_id=org.id, email=body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token(user.id, org.id, {"email": user.email})
    return TokenResponse(access_token=token, organization=org.name, user_id=user.id)


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    org = db.get(Organization, user.organization_id)
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "organization": org.name if org else None}


# ── Registry ────────────────────────────────────────────────────────────────


@router.post("/agents/register")
def register_agent(
    body: RegisterAgentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        contract = AgentContract.model_validate(body.contract)
    except Exception as exc:
        raise HTTPException(400, f"Invalid agent contract: {exc}") from exc

    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=contract.name).first()
    if not agent:
        agent = Agent(
            organization_id=user.organization_id,
            name=contract.name,
            description=contract.description,
        )
        db.add(agent)
        db.flush()

    existing = db.query(AgentVersion).filter_by(agent_id=agent.id, version=contract.version).first()
    if existing:
        raise HTTPException(409, f"Version {contract.version} already registered")

    version = AgentVersion(
        agent_id=agent.id,
        version=contract.version,
        contract=contract.model_dump(mode="json"),
        tags=body.tags,
        created_by=user.email,
    )
    db.add(version)
    _audit(db, user.organization_id, user.email, "agent.register", "agent_version", f"{contract.name}@{contract.version}")
    db.commit()
    return {"name": agent.name, "version": version.version, "id": agent.id}


@router.get("/agents")
def list_agents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    agents = db.query(Agent).filter_by(organization_id=user.organization_id).all()
    out: list[dict[str, Any]] = []
    for agent in agents:
        versions = sorted(agent.versions, key=lambda v: v.created_at, reverse=True)
        latest = versions[0] if versions else None
        active_dep = next((d for d in agent.deployments if d.status == "active"), None)
        out.append(
            {
                "name": agent.name,
                "description": agent.description,
                "latest_version": latest.version if latest else None,
                "environment": active_dep.environment if active_dep else None,
                "deployed_version": active_dep.version if active_dep else None,
                "versions": [v.version for v in versions],
            }
        )
    return out


@router.get("/agents/{name}")
def get_agent(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=name).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    return {
        "name": agent.name,
        "description": agent.description,
        "versions": [
            {"version": v.version, "contract": v.contract, "tags": v.tags, "created_at": v.created_at.isoformat()}
            for v in sorted(agent.versions, key=lambda x: x.created_at, reverse=True)
        ],
        "deployments": [
            {
                "id": d.id,
                "name": d.name,
                "environment": d.environment,
                "version": d.version,
                "previous_version": d.previous_version,
                "status": d.status,
                "deployed_at": d.deployed_at.isoformat(),
                "deployed_by": d.deployed_by,
            }
            for d in agent.deployments
        ],
    }


# ── Deploy / rollback ───────────────────────────────────────────────────────


@router.post("/agents/{name}/deploy")
def deploy_agent(
    name: str,
    body: DeployRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=name).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    version_str = body.version
    if not version_str:
        latest = sorted(agent.versions, key=lambda v: v.created_at, reverse=True)
        if not latest:
            raise HTTPException(400, "No versions registered")
        version_str = latest[0].version

    ver = db.query(AgentVersion).filter_by(agent_id=agent.id, version=version_str).first()
    if not ver:
        raise HTTPException(404, f"Version {version_str} not found")

    existing = (
        db.query(Deployment)
        .filter_by(agent_id=agent.id, environment=body.environment, name=body.name, status="active")
        .first()
    )
    previous = existing.version if existing else None
    if existing:
        existing.status = "superseded"

    contract = ver.contract or {}
    dep = Deployment(
        agent_id=agent.id,
        name=body.name,
        environment=body.environment,
        version=version_str,
        previous_version=previous,
        config=body.config,
        model=contract.get("model", {}),
        tools=contract.get("capabilities", []),
        status="active",
        deployed_by=user.email,
    )
    db.add(dep)
    db.flush()

    if body.seed_demo_policies:
        seed_demo_policies(db, user.organization_id, name, body.environment)

    _audit(
        db,
        user.organization_id,
        user.email,
        "agent.deploy",
        "deployment",
        dep.id,
        {"agent": name, "version": version_str, "environment": body.environment, "previous": previous},
    )
    db.commit()
    db.refresh(dep)
    return {
        "id": dep.id,
        "agent": name,
        "version": dep.version,
        "environment": dep.environment,
        "previous_version": previous,
        "status": dep.status,
    }


@router.post("/agents/{name}/rollback")
def rollback_agent(
    name: str,
    body: RollbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=name).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    current = (
        db.query(Deployment)
        .filter_by(agent_id=agent.id, environment=body.environment, name=body.name, status="active")
        .first()
    )
    if not current or not current.previous_version:
        raise HTTPException(400, "Nothing to roll back to")
    target = current.previous_version
    current.status = "rolled_back"
    dep = Deployment(
        agent_id=agent.id,
        name=body.name,
        environment=body.environment,
        version=target,
        previous_version=current.version,
        config=current.config,
        model=current.model,
        tools=current.tools,
        status="active",
        deployed_by=user.email,
    )
    db.add(dep)
    db.flush()
    _audit(
        db,
        user.organization_id,
        user.email,
        "agent.rollback",
        "deployment",
        dep.id,
        {"from": current.version, "to": target},
    )
    db.commit()
    return {"agent": name, "version": target, "environment": body.environment, "rolled_back_from": current.version}


# ── Policies ────────────────────────────────────────────────────────────────


@router.get("/policies")
def list_policies(
    agent: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = db.query(Policy).filter_by(organization_id=user.organization_id)
    if agent:
        q = q.filter_by(agent_name=agent)
    return [
        {
            "id": p.id,
            "agent_name": p.agent_name,
            "environment": p.environment,
            "resource": p.resource,
            "effect": p.effect,
            "conditions": p.conditions,
        }
        for p in q.all()
    ]


@router.put("/policies")
def upsert_policy(
    body: PolicyUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if body.effect not in {e.value for e in PolicyEffect}:
        raise HTTPException(400, "Invalid effect")
    existing = (
        db.query(Policy)
        .filter_by(
            organization_id=user.organization_id,
            agent_name=body.agent_name,
            environment=body.environment,
            resource=body.resource,
        )
        .first()
    )
    if existing:
        existing.effect = body.effect
        existing.conditions = body.conditions
        policy = existing
    else:
        policy = Policy(
            organization_id=user.organization_id,
            agent_name=body.agent_name,
            environment=body.environment,
            resource=body.resource,
            effect=body.effect,
            conditions=body.conditions,
        )
        db.add(policy)
    _audit(db, user.organization_id, user.email, "policy.upsert", "policy", body.resource, body.model_dump())
    db.commit()
    db.refresh(policy)
    return {"id": policy.id, "effect": policy.effect, "resource": policy.resource}


# ── Runs ────────────────────────────────────────────────────────────────────


@router.post("/runs")
def create_run(
    body: CreateRunRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=body.agent).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    dep = (
        db.query(Deployment)
        .filter_by(agent_id=agent.id, environment=body.environment, name=body.deployment, status="active")
        .first()
    )
    version = body.version or (dep.version if dep else None)
    if not version:
        raise HTTPException(400, "No deployment or version specified")
    ver = db.query(AgentVersion).filter_by(agent_id=agent.id, version=version).first()
    if not ver:
        raise HTTPException(404, "Version not found")

    run = Run(
        organization_id=user.organization_id,
        agent_name=agent.name,
        version=version,
        deployment_name=body.deployment,
        environment=body.environment,
        status="pending",
        input=body.input,
        triggered_by=user.email,
    )
    db.add(run)
    db.flush()
    db.add(
        RunEvent(
            run_id=run.id,
            type="run.created",
            status="pending",
            metadata_json={"triggered_by": user.email},
        )
    )
    _audit(db, user.organization_id, user.email, "run.create", "run", run.id)
    db.commit()
    db.refresh(run)
    return {
        "id": run.id,
        "agent": run.agent_name,
        "version": run.version,
        "status": run.status,
        "contract": ver.contract,
    }


@router.get("/runs")
def list_runs(
    agent: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = db.query(Run).filter_by(organization_id=user.organization_id).order_by(Run.created_at.desc())
    if agent:
        q = q.filter_by(agent_name=agent)
    if status:
        q = q.filter_by(status=status)
    return [
        {
            "id": r.id,
            "agent_name": r.agent_name,
            "version": r.version,
            "environment": r.environment,
            "status": r.status,
            "input": r.input,
            "output": r.output,
            "cost_estimate": r.cost_estimate,
            "created_at": r.created_at.isoformat(),
        }
        for r in q.limit(100).all()
    ]


@router.get("/runs/{run_id}")
def get_run(run_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    run = db.get(Run, run_id)
    if not run or run.organization_id != user.organization_id:
        raise HTTPException(404, "Run not found")
    events = db.query(RunEvent).filter_by(run_id=run.id).order_by(RunEvent.timestamp.asc()).all()
    return {
        "id": run.id,
        "agent_name": run.agent_name,
        "version": run.version,
        "deployment_name": run.deployment_name,
        "environment": run.environment,
        "status": run.status,
        "input": run.input,
        "output": run.output,
        "error": run.error,
        "cost_estimate": run.cost_estimate,
        "token_usage": run.token_usage,
        "created_at": run.created_at.isoformat(),
        "events": [
            {
                "id": e.id,
                "type": e.type,
                "timestamp": e.timestamp.isoformat(),
                "tool": e.tool,
                "status": e.status,
                "duration_ms": e.duration_ms,
                "policy_decision": e.policy_decision,
                "metadata": e.metadata_json,
                "redacted": e.redacted,
            }
            for e in events
        ],
    }


# ── Runner protocol endpoints ───────────────────────────────────────────────


@router.post("/runner/runs/{run_id}/claim")
def claim_run(
    run_id: str,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status not in {"pending", "waiting_approval"}:
        # Allow re-claim after approval
        if run.status != "running":
            raise HTTPException(409, f"Run not claimable: {run.status}")
    agent = db.query(Agent).filter_by(organization_id=run.organization_id, name=run.agent_name).first()
    ver = db.query(AgentVersion).filter_by(agent_id=agent.id, version=run.version).first() if agent else None
    org = db.get(Organization, run.organization_id)
    run.status = "running"
    run.started_at = run.started_at or datetime.utcnow()
    db.add(RunEvent(run_id=run.id, type="agent.started", status="running"))
    db.commit()
    return {
        "id": run.id,
        "organization": org.name if org else None,
        "organization_id": run.organization_id,
        "agent": run.agent_name,
        "version": run.version,
        "environment": run.environment,
        "deployment": run.deployment_name,
        "input": run.input,
        "contract": ver.contract if ver else {},
    }


@router.get("/runner/pending")
def pending_runs(_: bool = Depends(require_runner), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    runs = db.query(Run).filter(Run.status.in_(["pending", "waiting_approval"])).order_by(Run.created_at.asc()).limit(20).all()
    # waiting_approval is not auto-started; only pending
    pending = [r for r in runs if r.status == "pending"]
    return [{"id": r.id, "agent": r.agent_name, "version": r.version} for r in pending]


@router.post("/runner/tool-gate", response_model=ToolGateResponse)
def tool_gate(
    body: ToolGateRequest,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> ToolGateResponse:
    """External policy enforcement. Agents request; AgentOS decides and issues permits.

    Resource strings from the agent are never authoritative — the control plane
    derives the canonical resource from tool+action. Stopped runs cannot obtain
    permits. DENY attempts are audited as policy violations.
    """
    run = db.get(Run, body.run_id)
    if not run:
        raise HTTPException(404, "Run not found")

    resource = canonical_resource(body.tool, body.action)
    spoofed = body.resource is not None and body.resource != resource

    if run.status in TERMINAL_RUN_STATUSES or run.status == "stopped":
        decision = evaluate_policy(
            db, run.organization_id, run.agent_name, run.environment, resource
        )
        # Force deny for kill-switch / terminal regardless of policy allow
        from protocol import PolicyDecision

        forced = PolicyDecision(
            effect=PolicyEffect.DENY,
            rule=None,
            reason=f"Run is {run.status}; kill-switch/terminal state blocks tool permits",
            resource=resource,
            agent=run.agent_name,
        )
        db.add(
            RunEvent(
                run_id=run.id,
                type="policy.evaluated",
                tool=body.tool,
                status=PolicyEffect.DENY.value,
                policy_decision=forced.model_dump(mode="json"),
                metadata_json={
                    "action": body.action,
                    "resource": resource,
                    "client_resource": body.resource,
                    "risk": body.risk,
                    "kill_switch": True,
                },
            )
        )
        _audit(
            db,
            run.organization_id,
            f"agent:{run.agent_name}",
            "policy.violation",
            "run",
            run.id,
            {
                "tool": body.tool,
                "action": body.action,
                "resource": resource,
                "reason": forced.reason,
                "security_event": "POLICY_VIOLATION",
                "run_status": run.status,
            },
        )
        db.commit()
        return ToolGateResponse(
            effect=PolicyEffect.DENY.value,
            approval_id=None,
            decision=forced.model_dump(mode="json"),
            message=forced.reason,
            capability_token=None,
            resource=resource,
        )

    # Redeem path: prior human approval → single-use capability permit
    if body.approval_id:
        approval = db.get(Approval, body.approval_id)
        if (
            not approval
            or approval.run_id != run.id
            or approval.status != "approved"
            or approval.tool != body.tool
            or approval.action != body.action
        ):
            raise HTTPException(403, "Approval cannot be redeemed for this action")
        # Bind approval resource to canonical mapping
        if approval.resource != resource:
            raise HTTPException(403, "Approval resource does not match canonical tool/action")
        _, token = mint_capability_permit(
            db,
            run_id=run.id,
            organization_id=run.organization_id,
            tool=body.tool,
            action=body.action,
            resource=resource,
            approval_id=approval.id,
        )
        if run.status == "waiting_approval":
            run.status = "running"
        db.add(
            RunEvent(
                run_id=run.id,
                type="policy.evaluated",
                tool=body.tool,
                status=PolicyEffect.ALLOW.value,
                metadata_json={
                    "action": body.action,
                    "resource": resource,
                    "redeemed_approval": approval.id,
                },
                redacted=True,
            )
        )
        db.commit()
        return ToolGateResponse(
            effect=PolicyEffect.ALLOW.value,
            approval_id=approval.id,
            decision={
                "effect": PolicyEffect.ALLOW.value,
                "reason": "Human approval redeemed into capability permit",
                "resource": resource,
                "agent": run.agent_name,
            },
            message="Allowed via redeemed approval",
            capability_token=token,
            resource=resource,
        )

    if spoofed:
        _audit(
            db,
            run.organization_id,
            f"agent:{run.agent_name}",
            "policy.violation",
            "run",
            run.id,
            {
                "tool": body.tool,
                "action": body.action,
                "client_resource": body.resource,
                "canonical_resource": resource,
                "reason": "Agent attempted to spoof policy resource",
                "security_event": "POLICY_VIOLATION",
            },
        )

    decision = evaluate_policy(
        db,
        run.organization_id,
        run.agent_name,
        run.environment,
        resource,
    )
    db.add(
        RunEvent(
            run_id=run.id,
            type="policy.evaluated",
            tool=body.tool,
            status=decision.effect.value,
            policy_decision=decision.model_dump(mode="json"),
            metadata_json={
                "action": body.action,
                "resource": resource,
                "client_resource": body.resource,
                "risk": body.risk,
                "resource_spoof_attempt": spoofed,
            },
        )
    )

    if decision.effect == PolicyEffect.DENY or spoofed:
        # Spoof attempts are always denied even if a confused policy would allow
        effect = PolicyEffect.DENY
        message = (
            "Denied: agent-supplied resource does not match canonical tool/action mapping"
            if spoofed
            else decision.reason
        )
        _audit(
            db,
            run.organization_id,
            f"agent:{run.agent_name}",
            "policy.violation",
            "run",
            run.id,
            {
                "tool": body.tool,
                "action": body.action,
                "resource": resource,
                "reason": message,
                "security_event": "POLICY_VIOLATION",
                "attempted": f"{body.tool}.{body.action}",
                "policy": effect.value,
                "action_taken": "BLOCKED",
            },
        )
        db.commit()
        return ToolGateResponse(
            effect=effect.value,
            approval_id=None,
            decision=decision.model_dump(mode="json"),
            message=message,
            capability_token=None,
            resource=resource,
        )

    if decision.effect == PolicyEffect.APPROVAL_REQUIRED:
        approval = Approval(
            run_id=run.id,
            organization_id=run.organization_id,
            agent_name=run.agent_name,
            tool=body.tool,
            action=body.action,
            resource=resource,
            risk=body.risk,
            reason=body.reason,
            args=_redact_args(body.args),
            status="pending",
        )
        db.add(approval)
        run.status = "waiting_approval"
        db.add(
            RunEvent(
                run_id=run.id,
                type="approval.requested",
                tool=body.tool,
                status="pending",
                metadata_json={"resource": resource, "risk": body.risk, "reason": body.reason},
                redacted=True,
            )
        )
        db.commit()
        db.refresh(approval)
        return ToolGateResponse(
            effect=decision.effect.value,
            approval_id=approval.id,
            decision=decision.model_dump(mode="json"),
            message="Human approval required before tool execution",
            capability_token=None,
            resource=resource,
        )

    _, token = mint_capability_permit(
        db,
        run_id=run.id,
        organization_id=run.organization_id,
        tool=body.tool,
        action=body.action,
        resource=resource,
    )
    db.add(
        RunEvent(
            run_id=run.id,
            type="tool.requested",
            tool=body.tool,
            status="allowed",
            metadata_json={"action": body.action, "resource": resource},
            redacted=True,
        )
    )
    db.commit()
    return ToolGateResponse(
        effect=PolicyEffect.ALLOW.value,
        approval_id=None,
        decision=decision.model_dump(mode="json"),
        message="Allowed",
        capability_token=token,
        resource=resource,
    )


@router.post("/runner/runs/{run_id}/events")
def ingest_event(
    run_id: str,
    body: EventIngest,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if body.type in FORGED_EXECUTION_EVENT_TYPES:
        _audit(
            db,
            run.organization_id,
            "runner",
            "policy.violation",
            "run",
            run.id,
            {
                "reason": "Runner attempted to forge tool execution event without capability permit",
                "event_type": body.type,
                "security_event": "POLICY_VIOLATION",
                "action_taken": "BLOCKED",
            },
        )
        db.commit()
        raise HTTPException(
            403,
            "tool.executed/returned events require POST /runner/tool-result with a capability permit",
        )
    db.add(
        RunEvent(
            run_id=run.id,
            type=body.type,
            tool=body.tool,
            status=body.status,
            duration_ms=body.duration_ms,
            policy_decision=body.policy_decision,
            metadata_json=body.metadata,
            redacted=body.redacted,
        )
    )
    db.commit()
    return {"status": "ok"}


@router.post("/runner/capability-check")
def capability_check(
    body: CapabilityCheckRequest,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Pre-execute ledger check — kill-revoked permits fail here before connectors run."""
    run = db.get(Run, body.run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status in TERMINAL_RUN_STATUSES or run.status == "stopped":
        raise HTTPException(403, f"Run is {run.status}; kill-switch blocks execution")
    try:
        permit = validate_capability_for_execute(
            db,
            body.capability_token,
            run_id=body.run_id,
            tool=body.tool,
            action=body.action,
        )
    except PermitError as exc:
        _audit(
            db,
            run.organization_id,
            f"agent:{run.agent_name}",
            "policy.violation",
            "run",
            run.id,
            {
                "reason": str(exc),
                "tool": body.tool,
                "action": body.action,
                "security_event": "POLICY_VIOLATION",
                "action_taken": "BLOCKED",
                "phase": "pre_execute",
            },
        )
        db.commit()
        raise HTTPException(403, str(exc)) from exc
    return {
        "status": "ok",
        "jti": permit.jti,
        "resource": permit.resource,
    }


@router.post("/runner/tool-result")
def tool_result(
    body: ToolResultRequest,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Record tool execution only after consuming a control-plane capability permit."""
    run = db.get(Run, body.run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status in TERMINAL_RUN_STATUSES:
        raise HTTPException(403, f"Run is {run.status}; refusing tool-result")
    try:
        permit = consume_capability_token(
            db,
            body.capability_token,
            run_id=body.run_id,
            tool=body.tool,
            action=body.action,
        )
    except PermitError as exc:
        _audit(
            db,
            run.organization_id,
            f"agent:{run.agent_name}",
            "policy.violation",
            "run",
            run.id,
            {
                "reason": str(exc),
                "tool": body.tool,
                "action": body.action,
                "security_event": "POLICY_VIOLATION",
                "action_taken": "BLOCKED",
            },
        )
        db.commit()
        raise HTTPException(403, str(exc)) from exc

    db.add(
        RunEvent(
            run_id=run.id,
            type="tool.executed",
            tool=body.tool,
            status=body.status,
            duration_ms=body.duration_ms,
            metadata_json={
                **(body.metadata or {}),
                "action": body.action,
                "resource": permit.resource,
                "permit_jti": permit.jti,
            },
            redacted=True,
        )
    )
    db.add(
        RunEvent(
            run_id=run.id,
            type="tool.returned",
            tool=body.tool,
            status=body.status,
            duration_ms=body.duration_ms,
            metadata_json={"action": body.action, "permit_jti": permit.jti},
            redacted=True,
        )
    )
    db.commit()
    return {"status": "ok"}


@router.post("/runner/runs/{run_id}/complete")
def complete_run(
    run_id: str,
    payload: dict[str, Any],
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status == "stopped":
        raise HTTPException(403, "Run was stopped by operator; refusing completion overwrite")
    ok = payload.get("ok", True)
    run.status = "succeeded" if ok else "failed"
    run.output = payload.get("output")
    run.error = payload.get("error")
    run.cost_estimate = float(payload.get("cost_estimate", 0))
    run.token_usage = int(payload.get("token_usage", 0))
    run.finished_at = datetime.utcnow()
    db.add(
        RunEvent(
            run_id=run.id,
            type="agent.completed" if ok else "agent.failed",
            status=run.status,
            metadata_json={"cost_estimate": run.cost_estimate, "token_usage": run.token_usage},
        )
    )
    db.commit()
    return {"status": run.status}


@router.get("/runner/approvals/{approval_id}")
def get_approval_status(
    approval_id: str,
    _: bool = Depends(require_runner),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(404, "Approval not found")
    return {"id": approval.id, "status": approval.status, "decided_by": approval.decided_by}


# ── Approvals (human) ───────────────────────────────────────────────────────


@router.get("/approvals")
def list_approvals(
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = db.query(Approval).filter_by(organization_id=user.organization_id).order_by(Approval.created_at.desc())
    if status_filter:
        q = q.filter_by(status=status_filter)
    return [
        {
            "id": a.id,
            "run_id": a.run_id,
            "agent_name": a.agent_name,
            "tool": a.tool,
            "action": a.action,
            "resource": a.resource,
            "risk": a.risk,
            "reason": a.reason,
            "args": a.args,
            "status": a.status,
            "decided_by": a.decided_by,
            "decided_at": a.decided_at.isoformat() if a.decided_at else None,
            "created_at": a.created_at.isoformat(),
        }
        for a in q.limit(50).all()
    ]


@router.post("/approvals/{approval_id}/decide")
def decide_approval(
    approval_id: str,
    body: ApprovalDecision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    approval = db.get(Approval, approval_id)
    if not approval or approval.organization_id != user.organization_id:
        raise HTTPException(404, "Approval not found")
    if approval.status != "pending":
        raise HTTPException(400, "Already decided")
    if body.decision not in {"approve", "reject"}:
        raise HTTPException(400, "decision must be approve|reject")

    approval.status = "approved" if body.decision == "approve" else "rejected"
    approval.decided_by = user.email
    approval.decided_at = datetime.utcnow()

    run = db.get(Run, approval.run_id)
    if run:
        db.add(
            RunEvent(
                run_id=run.id,
                type="approval.decided",
                tool=approval.tool,
                status=approval.status,
                metadata_json={"decided_by": user.email, "decision": body.decision},
            )
        )
        if body.decision == "approve":
            run.status = "pending"  # runner will pick up continuation via resume API
        else:
            run.status = "failed"
            run.error = "Approval rejected"
            run.finished_at = datetime.utcnow()

    _audit(db, user.organization_id, user.email, f"approval.{body.decision}", "approval", approval.id)
    db.commit()
    return {"id": approval.id, "status": approval.status}


@router.post("/runs/{run_id}/resume")
def resume_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Mark a waiting run pending again after approval so the runner continues."""
    run = db.get(Run, run_id)
    if not run or run.organization_id != user.organization_id:
        raise HTTPException(404, "Run not found")
    approval = (
        db.query(Approval)
        .filter_by(run_id=run.id, status="approved")
        .order_by(Approval.decided_at.desc())
        .first()
    )
    if not approval:
        raise HTTPException(400, "No approved approval for this run")
    run.status = "pending"
    db.commit()
    return {"id": run.id, "status": run.status, "approval_id": approval.id}


@router.post("/runs/{run_id}/stop")
def stop_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Operator kill-switch: real containment, not a UI status flip.

    Sequence (deterministic enforcement — agent cannot refuse):
      1. Stop authorizing new actions (terminal run status)
      2. Reject open approvals
      3. Revoke outstanding capability grants
      4. Preserve forensic telemetry + audit containment
    """
    run = db.get(Run, run_id)
    if not run or run.organization_id != user.organization_id:
        raise HTTPException(404, "Run not found")
    if run.status in {"succeeded", "failed", "stopped"}:
        raise HTTPException(400, f"Run already terminal: {run.status}")

    pending = db.query(Approval).filter_by(run_id=run.id, status="pending").all()
    for approval in pending:
        approval.status = "rejected"
        approval.decided_by = user.email
        approval.decided_at = datetime.utcnow()

    # Containment: revoke before flipping status so concurrent execute checks fail
    revoked = revoke_run_capability_grants(db, run.id)

    run.status = "stopped"
    run.error = f"Stopped by {user.email}"
    run.finished_at = datetime.utcnow()
    db.add(
        RunEvent(
            run_id=run.id,
            type="agent.stopped",
            status="stopped",
            metadata_json={
                "stopped_by": user.email,
                "rejected_approvals": len(pending),
                "revoked_grants": revoked,
                "containment": [
                    "stop_new_actions",
                    "reject_approvals",
                    "revoke_credentials",
                    "preserve_telemetry",
                ],
            },
        )
    )
    _audit(
        db,
        user.organization_id,
        user.email,
        "run.stop",
        "run",
        run.id,
        {
            "rejected_approvals": len(pending),
            "revoked_grants": revoked,
            "security_event": "CONTAINMENT",
            "action_taken": "KILL",
        },
    )
    if revoked:
        _audit(
            db,
            user.organization_id,
            user.email,
            "credential.revoke",
            "run",
            run.id,
            {"revoked_grants": revoked, "security_event": "CONTAINMENT"},
        )
    db.commit()
    return {
        "id": run.id,
        "status": run.status,
        "rejected_approvals": len(pending),
        "revoked_grants": revoked,
    }


# ── Evaluations ─────────────────────────────────────────────────────────────


@router.post("/evaluations")
def run_evaluation(
    body: EvaluateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Framework-agnostic evaluation based on recorded runs + deterministic checks."""
    agent = db.query(Agent).filter_by(organization_id=user.organization_id, name=body.agent).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    ver = db.query(AgentVersion).filter_by(agent_id=agent.id, version=body.version).first()
    if not ver:
        raise HTTPException(404, "Version not found")

    runs = (
        db.query(Run)
        .filter_by(organization_id=user.organization_id, agent_name=body.agent, version=body.version)
        .order_by(Run.created_at.desc())
        .limit(20)
        .all()
    )

    case_results: list[dict[str, Any]] = []
    passed = 0
    # Deterministic suite derived from run evidence
    checks = [
        ("has_successful_run", lambda r: r.status == "succeeded"),
        ("has_policy_events", lambda r: _run_has_event(db, r.id, "policy.evaluated")),
        ("no_unapproved_writes", lambda r: _no_policy_violations(db, r.id)),
        ("timeline_complete", lambda r: _run_has_event(db, r.id, "agent.started") and (
            _run_has_event(db, r.id, "agent.completed") or _run_has_event(db, r.id, "agent.failed")
        )),
    ]

    if not runs:
        # Synthetic failed cases — cannot score without evidence
        case_results = [{"id": c[0], "passed": False, "reason": "No runs for version"} for c in checks]
        failed = len(checks)
        total = len(checks)
        score = 0.0
    else:
        # Evaluate against the latest successful-or-any run
        run = next((r for r in runs if r.status == "succeeded"), runs[0])
        for check_id, fn in checks:
            ok = bool(fn(run))
            case_results.append({"id": check_id, "passed": ok, "run_id": run.id})
            if ok:
                passed += 1
        failed = len(checks) - passed
        total = len(checks)
        score = round(100.0 * passed / total, 1)

    regression = "N/A"
    if body.baseline_version:
        baseline = (
            db.query(Evaluation)
            .filter_by(
                organization_id=user.organization_id,
                agent_name=body.agent,
                version=body.baseline_version,
                suite_name=body.suite_name,
            )
            .order_by(Evaluation.created_at.desc())
            .first()
        )
        if baseline:
            regression = "PASS" if score >= baseline.score else "FAIL"

    evaluation = Evaluation(
        organization_id=user.organization_id,
        suite_name=body.suite_name,
        agent_name=body.agent,
        version=body.version,
        score=score,
        passed=passed,
        failed=failed,
        total=total,
        regression=regression,
        case_results=case_results,
    )
    db.add(evaluation)
    _audit(db, user.organization_id, user.email, "evaluation.run", "evaluation", f"{body.agent}@{body.version}")
    db.commit()
    db.refresh(evaluation)
    return {
        "id": evaluation.id,
        "suite": evaluation.suite_name,
        "agent": evaluation.agent_name,
        "version": evaluation.version,
        "score": evaluation.score,
        "passed": evaluation.passed,
        "failed": evaluation.failed,
        "total": evaluation.total,
        "regression": evaluation.regression,
        "case_results": evaluation.case_results,
    }


@router.get("/evaluations")
def list_evaluations(
    agent: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = db.query(Evaluation).filter_by(organization_id=user.organization_id).order_by(Evaluation.created_at.desc())
    if agent:
        q = q.filter_by(agent_name=agent)
    return [
        {
            "id": e.id,
            "suite": e.suite_name,
            "agent": e.agent_name,
            "version": e.version,
            "score": e.score,
            "regression": e.regression,
            "case_results": e.case_results or [],
            "created_at": e.created_at.isoformat(),
        }
        for e in q.limit(50).all()
    ]


@router.get("/audit")
def list_audit(
    action: str | None = None,
    actor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    q = db.query(AuditEvent).filter_by(organization_id=user.organization_id)
    if action:
        q = q.filter(AuditEvent.action == action)
    if actor:
        q = q.filter(AuditEvent.actor == actor)
    events = q.order_by(AuditEvent.timestamp.desc()).limit(200).all()
    return [
        {
            "id": e.id,
            "actor": e.actor,
            "action": e.action,
            "target_type": e.target_type,
            "target_id": e.target_id,
            "details": e.details,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events
    ]


@router.get("/costs")
def cost_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    runs = db.query(Run).filter_by(organization_id=user.organization_id).all()
    by_agent: dict[str, dict[str, Any]] = {}
    for r in runs:
        slot = by_agent.setdefault(r.agent_name, {"agent": r.agent_name, "runs": 0, "cost": 0.0})
        slot["runs"] += 1
        slot["cost"] = round(slot["cost"] + (r.cost_estimate or 0), 2)
    return list(by_agent.values())


# ── helpers ─────────────────────────────────────────────────────────────────


def _redact_args(args: dict[str, Any]) -> dict[str, Any]:
    sensitive = {"token", "password", "secret", "authorization", "api_key", "content"}
    out: dict[str, Any] = {}
    for k, v in args.items():
        if k.lower() in sensitive or any(s in k.lower() for s in ("secret", "token", "password")):
            out[k] = "***REDACTED***"
        elif isinstance(v, str) and len(v) > 500:
            out[k] = v[:100] + "…[truncated]"
        else:
            out[k] = v
    return out


def _run_has_event(db: Session, run_id: str, event_type: str) -> bool:
    return db.query(RunEvent).filter_by(run_id=run_id, type=event_type).first() is not None


def _no_policy_violations(db: Session, run_id: str) -> bool:
    """True if no DENY was ignored — we treat presence of deny without later tool.executed as ok;
    any tool.executed after DENY for same tool is a violation (should not happen if runner is honest).
    """
    events = db.query(RunEvent).filter_by(run_id=run_id).order_by(RunEvent.timestamp.asc()).all()
    denied_tools: set[str] = set()
    for e in events:
        if e.type == "policy.evaluated" and e.policy_decision and e.policy_decision.get("effect") == "DENY":
            if e.tool:
                denied_tools.add(e.tool)
        if e.type == "tool.executed" and e.tool in denied_tools:
            return False
    return True
