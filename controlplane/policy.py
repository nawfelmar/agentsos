"""Policy engine — least privilege by default."""

from __future__ import annotations

from sqlalchemy.orm import Session

from controlplane.models import Policy
from protocol import AgentIdentity, PolicyDecision, PolicyEffect


DEFAULT_DENY_REASON = "No matching allow rule (least privilege default)"


def evaluate_policy(
    db: Session,
    organization_id: str,
    agent_name: str,
    environment: str,
    resource: str,
    identity: AgentIdentity | None = None,
) -> PolicyDecision:
    """Evaluate policy for a tool/resource access.

    Precedence:
    1. Exact agent + environment + resource DENY
    2. Exact agent + environment + resource APPROVAL_REQUIRED / ALLOW
    3. Wildcard environment (*)
    4. Default DENY
    """
    rules = (
        db.query(Policy)
        .filter(
            Policy.organization_id == organization_id,
            Policy.agent_name == agent_name,
            Policy.resource == resource,
            Policy.environment.in_([environment, "*"]),
        )
        .all()
    )

    # Prefer environment-specific over wildcard
    specific = [r for r in rules if r.environment == environment]
    wildcard = [r for r in rules if r.environment == "*"]
    ordered = specific + wildcard

    for rule in ordered:
        effect = PolicyEffect(rule.effect)
        return PolicyDecision(
            effect=effect,
            rule=rule.id,
            reason=f"Matched policy {rule.effect} for {resource} in {rule.environment}",
            resource=resource,
            agent=agent_name,
            identity=identity,
        )

    return PolicyDecision(
        effect=PolicyEffect.DENY,
        rule=None,
        reason=DEFAULT_DENY_REASON,
        resource=resource,
        agent=agent_name,
        identity=identity,
    )


def seed_demo_policies(db: Session, organization_id: str, agent_name: str, environment: str = "local") -> None:
    """Demo policies for CodingAgent: jira.read ALLOW, git.read ALLOW, git.write APPROVAL_REQUIRED."""
    defaults = [
        ("jira.read", PolicyEffect.ALLOW.value),
        ("git.read", PolicyEffect.ALLOW.value),
        ("git.write", PolicyEffect.APPROVAL_REQUIRED.value),
        ("git.delete", PolicyEffect.DENY.value),
        ("http.request", PolicyEffect.ALLOW.value),
        ("secrets.access", PolicyEffect.DENY.value),
    ]
    for resource, effect in defaults:
        existing = (
            db.query(Policy)
            .filter_by(
                organization_id=organization_id,
                agent_name=agent_name,
                environment=environment,
                resource=resource,
            )
            .first()
        )
        if not existing:
            db.add(
                Policy(
                    organization_id=organization_id,
                    agent_name=agent_name,
                    environment=environment,
                    resource=resource,
                    effect=effect,
                )
            )
    db.flush()
