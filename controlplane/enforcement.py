"""External enforcement — AgentOS decides; infrastructure enforces.

The agent is untrusted. Policy evaluation, capability issuance, and connector
execution permits live outside the LLM. Agents may *request* actions; only a
control-plane-issued capability permit authorizes connectors to run.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from controlplane.models import CapabilityGrant
from controlplane.settings import settings

# Run statuses where no further privileged tool activity is allowed.
TERMINAL_RUN_STATUSES = frozenset({"succeeded", "failed", "stopped", "cancelled"})

# Runner-reported event types that would forge a successful tool execution.
FORGED_EXECUTION_EVENT_TYPES = frozenset(
    {
        "tool.executed",
        "tool.returned",
        "tool.succeeded",
        "tool.completed",
    }
)

# Short-lived permits after ALLOW / approved redemption.
DEFAULT_PERMIT_TTL_SECONDS = 120


def canonical_resource(tool: str, action: str) -> str:
    """Server-side tool+action → policy resource. Never trust agent-supplied resource."""
    write_actions = {"write_file", "commit", "push", "delete", "merge"}
    if tool == "git":
        if action in write_actions:
            return "git.write"
        if action in {"delete_branch", "rm"}:
            return "git.delete"
        return "git.read"
    if tool == "jira":
        if action in {"create_issue", "update_issue", "transition"}:
            return "jira.write"
        return "jira.read"
    if tool == "http":
        return "http.request"
    if tool == "shell":
        return "shell.exec"
    if tool == "secrets":
        return "secrets.access"
    return f"{tool}.{action}"


@dataclass(frozen=True)
class CapabilityPermit:
    jti: str
    run_id: str
    organization_id: str
    tool: str
    action: str
    resource: str
    exp: int
    approval_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "jti": self.jti,
            "run_id": self.run_id,
            "organization_id": self.organization_id,
            "tool": self.tool,
            "action": self.action,
            "resource": self.resource,
            "exp": self.exp,
            "approval_id": self.approval_id,
        }


def _sign(payload_b64: str) -> str:
    key = settings.jwt_secret.encode("utf-8")
    return hmac.new(key, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def mint_capability_permit(
    db: Session,
    *,
    run_id: str,
    organization_id: str,
    tool: str,
    action: str,
    resource: str | None = None,
    approval_id: str | None = None,
    ttl_seconds: int = DEFAULT_PERMIT_TTL_SECONDS,
) -> tuple[CapabilityPermit, str]:
    """Create a single-use, short-lived permit and return (permit, token)."""
    resolved = resource or canonical_resource(tool, action)
    if resolved != canonical_resource(tool, action):
        raise ValueError("resource does not match canonical tool/action mapping")

    jti = str(uuid4())
    exp = int(time.time()) + ttl_seconds
    permit = CapabilityPermit(
        jti=jti,
        run_id=run_id,
        organization_id=organization_id,
        tool=tool,
        action=action,
        resource=resolved,
        exp=exp,
        approval_id=approval_id,
    )
    db.add(
        CapabilityGrant(
            id=jti,
            organization_id=organization_id,
            run_id=run_id,
            tool=tool,
            action=action,
            resource=resolved,
            approval_id=approval_id,
            expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
        )
    )
    payload_b64 = json.dumps(permit.as_dict(), separators=(",", ":"), sort_keys=True)
    token = f"{payload_b64}.{_sign(payload_b64)}"
    return permit, token


class PermitError(PermissionError):
    """Raised when a capability permit is missing, forged, expired, or reused."""


def verify_capability_token(token: str) -> CapabilityPermit:
    if not token or "." not in token:
        raise PermitError("Missing or malformed capability permit")
    payload_b64, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload_b64), sig):
        raise PermitError("Invalid capability permit signature")
    try:
        data = json.loads(payload_b64)
    except json.JSONDecodeError as exc:
        raise PermitError("Invalid capability permit payload") from exc
    required = {"jti", "run_id", "organization_id", "tool", "action", "resource", "exp"}
    if not required.issubset(data):
        raise PermitError("Incomplete capability permit")
    if int(data["exp"]) < int(time.time()):
        raise PermitError("Capability permit expired")
    if data["resource"] != canonical_resource(data["tool"], data["action"]):
        raise PermitError("Capability permit resource mismatch")
    return CapabilityPermit(
        jti=data["jti"],
        run_id=data["run_id"],
        organization_id=data["organization_id"],
        tool=data["tool"],
        action=data["action"],
        resource=data["resource"],
        exp=int(data["exp"]),
        approval_id=data.get("approval_id"),
    )


def assert_grant_active(db: Session, permit: CapabilityPermit) -> CapabilityGrant:
    """Ledger check: grant must exist, be unrevoked, unconsumed, and unexpired.

    HMAC signature alone is insufficient after a kill — revoked grants stay
    cryptographically valid until TTL, but the ledger refuses them.
    """
    grant = db.get(CapabilityGrant, permit.jti)
    if not grant:
        raise PermitError("Capability permit unknown or revoked")
    if grant.revoked_at is not None:
        raise PermitError("Capability permit revoked")
    if grant.consumed_at is not None:
        raise PermitError("Capability permit already consumed")
    if grant.expires_at and grant.expires_at < datetime.utcnow():
        raise PermitError("Capability permit expired")
    if grant.run_id != permit.run_id:
        raise PermitError("Capability permit run mismatch")
    return grant


def validate_capability_for_execute(
    db: Session,
    token: str,
    *,
    run_id: str,
    tool: str,
    action: str,
) -> CapabilityPermit:
    """Pre-execute check: signature + ledger. Does not consume the permit."""
    permit = verify_capability_token(token)
    if permit.run_id != run_id or permit.tool != tool or permit.action != action:
        raise PermitError("Capability permit does not match requested action")
    if permit.resource != canonical_resource(tool, action):
        raise PermitError("Capability permit resource mismatch")
    assert_grant_active(db, permit)
    return permit


def consume_capability_token(
    db: Session,
    token: str,
    *,
    run_id: str,
    tool: str,
    action: str,
) -> CapabilityPermit:
    """Verify permit and mark single-use grant consumed. Infrastructure authority."""
    permit = validate_capability_for_execute(
        db, token, run_id=run_id, tool=tool, action=action
    )
    grant = db.get(CapabilityGrant, permit.jti)
    assert grant is not None  # validated above
    grant.consumed_at = datetime.utcnow()
    db.flush()
    return permit


def revoke_run_capability_grants(db: Session, run_id: str) -> int:
    """Kill-switch containment: revoke all outstanding permits for a run.

    Returns the number of grants newly revoked. Already-consumed grants are
    left unchanged (forensic trail). The agent cannot refuse this.
    """
    now = datetime.utcnow()
    grants = (
        db.query(CapabilityGrant)
        .filter(
            CapabilityGrant.run_id == run_id,
            CapabilityGrant.revoked_at.is_(None),
            CapabilityGrant.consumed_at.is_(None),
        )
        .all()
    )
    for grant in grants:
        grant.revoked_at = now
    db.flush()
    return len(grants)


def refuse_if_grant_revoked(db: Session | None, permit: CapabilityPermit) -> None:
    """Connector defense-in-depth: if a ledger row exists, honor revoke/consume.

    HMAC-only tokens without a grant row (local unit tests) still verify by
    signature. Production tool-gate always mints a grant; kill sets revoked_at.
    """
    if db is None:
        return
    grant = db.get(CapabilityGrant, permit.jti)
    if grant is None:
        return
    if grant.revoked_at is not None:
        raise PermitError("Capability permit revoked")
    if grant.consumed_at is not None:
        raise PermitError("Capability permit already consumed")
    if grant.expires_at and grant.expires_at < datetime.utcnow():
        raise PermitError("Capability permit expired")

def issue_signed_capability_token(
    *,
    run_id: str,
    organization_id: str,
    tool: str,
    action: str,
    approval_id: str | None = None,
    ttl_seconds: int = DEFAULT_PERMIT_TTL_SECONDS,
) -> str:
    """Sign a capability token without persisting a grant.

    Used by connector unit tests and local verify paths. Control-plane ALLOW
    still persists grants via mint_capability_permit for single-use consume.
    """
    import json
    import time
    from uuid import uuid4

    permit = CapabilityPermit(
        jti=str(uuid4()),
        run_id=run_id,
        organization_id=organization_id,
        tool=tool,
        action=action,
        resource=canonical_resource(tool, action),
        exp=int(time.time()) + ttl_seconds,
        approval_id=approval_id,
    )
    payload_b64 = json.dumps(permit.as_dict(), separators=(",", ":"), sort_keys=True)
    return f"{payload_b64}.{_sign(payload_b64)}"

