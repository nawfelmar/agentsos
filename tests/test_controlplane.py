"""Unit and API tests for AgentOS control plane."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Isolate DB per test session
os.environ["AGENTOS_DATABASE_URL"] = "sqlite:///./test_agentos.db"
test_db = ROOT / "test_agentos.db"
if test_db.exists():
    test_db.unlink()

from controlplane.app import app  # noqa: E402
from controlplane.db import Base, engine  # noqa: E402
from protocol import AgentContract, PolicyEffect  # noqa: E402
from controlplane.policy import evaluate_policy  # noqa: E402
from controlplane.db import SessionLocal  # noqa: E402
from controlplane.models import Organization, Policy  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth(client: TestClient):
    r = client.post(
        "/api/v1/auth/register",
        json={
            "organization": "acme",
            "email": "a@acme.test",
            "name": "Admin",
            "password": "secret123",
        },
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client: TestClient):
    assert client.get("/health").json()["status"] == "ok"


def test_agent_contract_does_not_prescribe_reasoning():
    c = AgentContract(name="x", version="1.0.0", capabilities=["git.read"])
    assert "reasoning" not in c.model_dump()
    assert c.runtime.type.value in {"process", "container", "http"}


def test_policy_default_deny():
    db = SessionLocal()
    org = Organization(name="o1")
    db.add(org)
    db.commit()
    decision = evaluate_policy(db, org.id, "coding-agent", "local", "git.write")
    assert decision.effect == PolicyEffect.DENY
    db.close()


def test_policy_approval_required():
    db = SessionLocal()
    org = Organization(name="o2")
    db.add(org)
    db.flush()
    db.add(
        Policy(
            organization_id=org.id,
            agent_name="coding-agent",
            environment="local",
            resource="git.write",
            effect="APPROVAL_REQUIRED",
        )
    )
    db.commit()
    decision = evaluate_policy(db, org.id, "coding-agent", "local", "git.write")
    assert decision.effect == PolicyEffect.APPROVAL_REQUIRED
    db.close()


def test_register_deploy_run_policy_gate(client: TestClient, auth: dict):
    contract = {
        "name": "coding-agent",
        "version": "1.0.0",
        "description": "test",
        "capabilities": ["jira.read", "git.read", "git.write"],
        "runtime": {"type": "process"},
        "model": {"provider": "customer-managed", "model": "stub"},
    }
    r = client.post("/api/v1/agents/register", headers=auth, json={"contract": contract})
    assert r.status_code == 200, r.text

    r = client.post(
        "/api/v1/agents/coding-agent/deploy",
        headers=auth,
        json={"environment": "local", "version": "1.0.0", "seed_demo_policies": True},
    )
    assert r.status_code == 200, r.text

    policies = client.get("/api/v1/policies?agent=coding-agent", headers=auth).json()
    effects = {p["resource"]: p["effect"] for p in policies}
    assert effects["git.write"] == "APPROVAL_REQUIRED"
    assert effects["jira.read"] == "ALLOW"

    r = client.post(
        "/api/v1/runs",
        headers=auth,
        json={"agent": "coding-agent", "environment": "local", "input": {"ticket": "AUTO-42"}},
    )
    assert r.status_code == 200
    run_id = r.json()["id"]

    # Runner claims and gates write
    runner = {"Authorization": "Bearer dev-runner-token"}
    claim = client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    assert claim.status_code == 200

    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "git",
            "action": "write_file",
            "resource": "git.write",
            "args": {"path": "src/thresholds.yaml", "content": "x: 1\n"},
            "risk": "HIGH",
            "reason": "Align threshold",
        },
    )
    assert gate.status_code == 200
    body = gate.json()
    assert body["effect"] == "APPROVAL_REQUIRED"
    assert body["approval_id"]

    approvals = client.get("/api/v1/approvals?status_filter=pending", headers=auth).json()
    assert len(approvals) == 1

    decided = client.post(
        f"/api/v1/approvals/{body['approval_id']}/decide",
        headers=auth,
        json={"decision": "approve"},
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "approved"

    # After approval, allow path on subsequent gate when policies still APPROVAL_REQUIRED
    # would ask again — runner uses approval status. Verify timeline has policy + approval events.
    timeline = client.get(f"/api/v1/runs/{run_id}", headers=auth).json()
    types = [e["type"] for e in timeline["events"]]
    assert "policy.evaluated" in types
    assert "approval.requested" in types
    assert "approval.decided" in types


def test_deploy_rollback_and_eval(client: TestClient, auth: dict):
    for ver in ("1.0.0", "2.0.0"):
        r = client.post(
            "/api/v1/agents/register",
            headers=auth,
            json={
                "contract": {
                    "name": "coding-agent",
                    "version": ver,
                    "capabilities": ["git.read"],
                    "runtime": {"type": "process"},
                }
            },
        )
        assert r.status_code == 200, r.text

    d1 = client.post(
        "/api/v1/agents/coding-agent/deploy",
        headers=auth,
        json={"environment": "local", "version": "1.0.0"},
    ).json()
    assert d1["version"] == "1.0.0"

    d2 = client.post(
        "/api/v1/agents/coding-agent/deploy",
        headers=auth,
        json={"environment": "local", "version": "2.0.0"},
    ).json()
    assert d2["previous_version"] == "1.0.0"

    rb = client.post(
        "/api/v1/agents/coding-agent/rollback",
        headers=auth,
        json={"environment": "local"},
    ).json()
    assert rb["version"] == "1.0.0"

    # Create a succeeded run evidence for eval
    run = client.post(
        "/api/v1/runs",
        headers=auth,
        json={"agent": "coding-agent", "environment": "local", "input": {}},
    ).json()
    runner = {"Authorization": "Bearer dev-runner-token"}
    client.post(f"/api/v1/runner/runs/{run['id']}/claim", headers=runner)
    client.post(
        f"/api/v1/runner/runs/{run['id']}/events",
        headers=runner,
        json={"type": "policy.evaluated", "status": "ALLOW", "redacted": True},
    )
    client.post(
        f"/api/v1/runner/runs/{run['id']}/complete",
        headers=runner,
        json={"ok": True, "output": {"ok": True}, "cost_estimate": 0.01},
    )

    ev = client.post(
        "/api/v1/evaluations",
        headers=auth,
        json={"agent": "coding-agent", "version": "1.0.0", "suite_name": "default"},
    ).json()
    assert ev["score"] >= 75.0
