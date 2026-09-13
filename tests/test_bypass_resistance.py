"""Bypass-resistance tests — infrastructure blocks untrusted agents.

These assert AgentOS limits what an agent can *actually do*, independent of
what the agent decides, claims, or attempts.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ["AGENTOS_DATABASE_URL"] = "sqlite:///./test_bypass_agentos.db"
test_db = ROOT / "test_bypass_agentos.db"
if test_db.exists():
    test_db.unlink()

from controlplane.app import app  # noqa: E402
from controlplane.db import Base, engine  # noqa: E402
from controlplane.enforcement import canonical_resource, issue_signed_capability_token  # noqa: E402
from connectors import ConnectorError, GitConnector  # noqa: E402


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
            "organization": "secure-co",
            "email": "sec@secure.test",
            "name": "Sec",
            "password": "secret123",
        },
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def runner():
    return {"Authorization": "Bearer dev-runner-token"}


def _register_deploy_run(client: TestClient, auth: dict) -> str:
    contract = {
        "name": "coding-agent",
        "version": "1.0.0",
        "description": "bypass tests",
        "capabilities": ["jira.read", "git.read", "git.write"],
        "runtime": {"type": "process"},
        "model": {"provider": "customer-managed", "model": "stub"},
    }
    assert client.post("/api/v1/agents/register", headers=auth, json={"contract": contract}).status_code == 200
    assert (
        client.post(
            "/api/v1/agents/coding-agent/deploy",
            headers=auth,
            json={"environment": "local", "version": "1.0.0", "seed_demo_policies": True},
        ).status_code
        == 200
    )
    run = client.post(
        "/api/v1/runs",
        headers=auth,
        json={"agent": "coding-agent", "environment": "local", "input": {"ticket": "SEC-1"}},
    ).json()
    return run["id"]


def test_ignore_assigned_permissions_denied(client: TestClient, auth: dict, runner: dict):
    """Agent requests secrets.access despite having no allow rule → DENY + audit."""
    run_id = _register_deploy_run(client, auth)
    assert client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner).status_code == 200
    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "secrets",
            "action": "access",
            "args": {"name": "prod-db"},
            "risk": "CRITICAL",
            "reason": "I decided I need this",
        },
    ).json()
    assert gate["effect"] == "DENY"
    assert gate.get("capability_token") is None
    audit = client.get("/api/v1/audit", headers=auth).json()
    assert any(e["action"] == "policy.violation" for e in audit)


def test_resource_spoof_blocked(client: TestClient, auth: dict, runner: dict):
    """Agent claims resource=git.read while requesting write_file → DENY."""
    run_id = _register_deploy_run(client, auth)
    client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "git",
            "action": "write_file",
            "resource": "git.read",  # spoof
            "args": {"path": "x.py", "content": "pwned"},
            "risk": "HIGH",
        },
    ).json()
    assert gate["effect"] == "DENY"
    assert gate["resource"] == "git.write"
    assert "spoof" in gate["message"].lower() or "does not match" in gate["message"].lower()


def test_canonical_resource_ignores_agent_labels():
    assert canonical_resource("git", "write_file") == "git.write"
    assert canonical_resource("git", "read_file") == "git.read"
    assert canonical_resource("shell", "exec") == "shell.exec"


def test_direct_connector_invoke_without_permit_blocked(tmp_path: Path):
    """Bypass tool gateway by calling connector directly → refused."""
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    with pytest.raises(ConnectorError, match="capability permit"):
        git.execute("write_file", {"path": "evil.txt", "content": "x"})


def test_forge_tool_executed_event_blocked(client: TestClient, auth: dict, runner: dict):
    """Agent/runner forges tool.executed without permit → 403 + audit."""
    run_id = _register_deploy_run(client, auth)
    client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    r = client.post(
        f"/api/v1/runner/runs/{run_id}/events",
        headers=runner,
        json={"type": "tool.executed", "tool": "git", "status": "ok", "redacted": True},
    )
    assert r.status_code == 403
    audit = client.get("/api/v1/audit", headers=auth).json()
    assert any(e["action"] == "policy.violation" for e in audit)


def test_kill_switch_blocks_further_permits(client: TestClient, auth: dict, runner: dict):
    """Operator stop → subsequent tool-gate DENY; complete cannot overwrite."""
    run_id = _register_deploy_run(client, auth)
    client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    stop = client.post(f"/api/v1/runs/{run_id}/stop", headers=auth)
    assert stop.status_code == 200
    assert stop.json()["status"] == "stopped"

    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "jira",
            "action": "get_issue",
            "args": {"key": "AUTO-42"},
        },
    ).json()
    assert gate["effect"] == "DENY"
    assert "stopped" in gate["message"].lower() or "kill" in gate["message"].lower()

    done = client.post(
        f"/api/v1/runner/runs/{run_id}/complete",
        headers=runner,
        json={"ok": True, "output": {"sneaky": True}},
    )
    assert done.status_code == 403


def test_denied_git_delete_cannot_get_permit(client: TestClient, auth: dict, runner: dict):
    run_id = _register_deploy_run(client, auth)
    client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "git",
            "action": "delete_branch",
            "args": {"name": "main"},
            "risk": "CRITICAL",
        },
    ).json()
    assert gate["effect"] == "DENY"
    assert gate["resource"] == "git.delete"
    assert gate.get("capability_token") is None


def test_allow_issues_permit_and_tool_result_consumes(client: TestClient, auth: dict, runner: dict):
    run_id = _register_deploy_run(client, auth)
    client.post(f"/api/v1/runner/runs/{run_id}/claim", headers=runner)
    gate = client.post(
        "/api/v1/runner/tool-gate",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "jira",
            "action": "get_issue",
            "args": {"key": "AUTO-42"},
        },
    ).json()
    assert gate["effect"] == "ALLOW"
    token = gate["capability_token"]
    assert token

    ok = client.post(
        "/api/v1/runner/tool-result",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "jira",
            "action": "get_issue",
            "capability_token": token,
            "status": "ok",
            "duration_ms": 3,
        },
    )
    assert ok.status_code == 200

    # Reuse of single-use permit fails
    reuse = client.post(
        "/api/v1/runner/tool-result",
        headers=runner,
        json={
            "run_id": run_id,
            "tool": "jira",
            "action": "get_issue",
            "capability_token": token,
            "status": "ok",
        },
    )
    assert reuse.status_code == 403


def test_unsigned_permit_cannot_authorize_connector(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    bogus = issue_signed_capability_token(
        run_id="r",
        organization_id="o",
        tool="jira",  # wrong tool for git connector
        action="get_issue",
    )
    with pytest.raises(ConnectorError):
        git.execute("status", {}, capability_token=bogus)
