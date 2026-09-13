"""Execution plane runner — agents execute here; control plane gets metadata."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from connectors import ConnectorRegistry, GitConnector, HttpConnector, JiraConnector


class ControlPlaneClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, headers=self.headers, timeout=60.0)

    def pending(self) -> list[dict[str, Any]]:
        with self._client() as c:
            r = c.get("/api/v1/runner/pending")
            r.raise_for_status()
            return r.json()

    def claim(self, run_id: str) -> dict[str, Any]:
        with self._client() as c:
            r = c.post(f"/api/v1/runner/runs/{run_id}/claim")
            r.raise_for_status()
            return r.json()

    def tool_gate(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._client() as c:
            r = c.post("/api/v1/runner/tool-gate", json=payload)
            r.raise_for_status()
            return r.json()

    def event(self, run_id: str, payload: dict[str, Any]) -> None:
        with self._client() as c:
            r = c.post(f"/api/v1/runner/runs/{run_id}/events", json=payload)
            r.raise_for_status()

    def complete(self, run_id: str, payload: dict[str, Any]) -> None:
        with self._client() as c:
            r = c.post(f"/api/v1/runner/runs/{run_id}/complete", json=payload)
            r.raise_for_status()

    def approval_status(self, approval_id: str) -> dict[str, Any]:
        with self._client() as c:
            r = c.get(f"/api/v1/runner/approvals/{approval_id}")
            r.raise_for_status()
            return r.json()

    def tool_result(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._client() as c:
            r = c.post("/api/v1/runner/tool-result", json=payload)
            r.raise_for_status()
            return r.json()


class ExecutionGateway:
    """All tool calls go through external policy before connector execution.

    The agent only *requests*. AgentOS evaluates policy, issues a capability
    permit, and connectors refuse to run without that permit.
    """

    def __init__(self, cp: ControlPlaneClient, connectors: ConnectorRegistry, run_id: str):
        self.cp = cp
        self.connectors = connectors
        self.run_id = run_id
        self.pending_approval: dict[str, Any] | None = None

    def call(self, tool: str, action: str, args: dict[str, Any], reason: str | None = None, risk: str = "MEDIUM") -> dict[str, Any]:
        resource = self.connectors.resource_for(tool, action)
        self.cp.event(
            self.run_id,
            {
                "type": "tool.requested",
                "tool": tool,
                "status": "requested",
                "metadata": {"action": action, "resource": resource},
                "redacted": True,
            },
        )
        gate = self.cp.tool_gate(
            {
                "run_id": self.run_id,
                "tool": tool,
                "action": action,
                "resource": resource,
                "args": args,
                "risk": risk,
                "reason": reason,
            }
        )
        effect = gate["effect"]
        if effect == "DENY":
            raise PermissionError(gate["message"])
        if effect == "APPROVAL_REQUIRED":
            self.pending_approval = {
                "approval_id": gate["approval_id"],
                "tool": tool,
                "action": action,
                "args": args,
                "reason": reason,
                "risk": risk,
            }
            raise ApprovalRequired(gate["approval_id"], gate["message"])

        token = gate.get("capability_token")
        if not token:
            raise PermissionError("Control plane ALLOW missing capability permit")
        return self._execute(tool, action, args, capability_token=token)

    def resume_after_approval(self) -> dict[str, Any]:
        assert self.pending_approval
        info = self.pending_approval
        status = self.cp.approval_status(info["approval_id"])
        if status["status"] != "approved":
            raise PermissionError(f"Approval not granted: {status['status']}")
        # Redeem approval into a fresh capability permit — do not execute on trust alone
        resource = self.connectors.resource_for(info["tool"], info["action"])
        gate = self.cp.tool_gate(
            {
                "run_id": self.run_id,
                "tool": info["tool"],
                "action": info["action"],
                "resource": resource,
                "args": info["args"],
                "risk": info.get("risk", "MEDIUM"),
                "reason": info.get("reason"),
                "approval_id": info["approval_id"],
            }
        )
        if gate["effect"] != "ALLOW" or not gate.get("capability_token"):
            raise PermissionError(gate.get("message") or "Approval redemption failed")
        result = self._execute(
            info["tool"], info["action"], info["args"], capability_token=gate["capability_token"]
        )
        self.pending_approval = None
        return result

    def _execute(
        self,
        tool: str,
        action: str,
        args: dict[str, Any],
        *,
        capability_token: str,
    ) -> dict[str, Any]:
        start = time.time()
        connector = self.connectors.get(tool)
        try:
            output = connector.execute(action, args, capability_token=capability_token)
            duration = int((time.time() - start) * 1000)
            # Record outcome via permit redemption — cannot forge tool.executed via events API
            self.cp.tool_result(
                {
                    "run_id": self.run_id,
                    "tool": tool,
                    "action": action,
                    "capability_token": capability_token,
                    "status": "ok",
                    "duration_ms": duration,
                    "metadata": {"keys": list(output.keys()) if isinstance(output, dict) else []},
                }
            )
            return output
        except Exception as exc:
            duration = int((time.time() - start) * 1000)
            try:
                self.cp.tool_result(
                    {
                        "run_id": self.run_id,
                        "tool": tool,
                        "action": action,
                        "capability_token": capability_token,
                        "status": "error",
                        "duration_ms": duration,
                        "metadata": {"error": str(exc)},
                    }
                )
            except Exception:
                # Permit may be unconsumed if connector refused before CP redeem; best-effort
                pass
            raise

class ApprovalRequired(Exception):
    def __init__(self, approval_id: str, message: str):
        super().__init__(message)
        self.approval_id = approval_id


def build_connectors(workspace: str) -> ConnectorRegistry:
    return ConnectorRegistry(
        {
            "git": GitConnector(workspace),
            "jira": JiraConnector(),
            "http": HttpConnector(),
        }
    )


def run_process_agent(claim: dict[str, Any], gateway: ExecutionGateway, state_path: Path) -> dict[str, Any]:
    """Invoke example/process agent via stdin/stdout JSON protocol."""
    contract = claim.get("contract") or {}
    runtime = contract.get("runtime") or {}
    entry = contract.get("entrypoint") or runtime.get("command")
    if isinstance(entry, list):
        cmd = entry
    elif isinstance(entry, str):
        cmd = [sys.executable, entry] if entry.endswith(".py") else entry.split()
    else:
        # Default demo agent
        cmd = [sys.executable, str(Path(__file__).resolve().parents[1] / "examples" / "coding-agent" / "agent.py")]

    env = os.environ.copy()
    env["AGENTOS_RUN_ID"] = claim["id"]
    env["AGENTOS_AGENT"] = claim["agent"]
    env["AGENTOS_VERSION"] = claim["version"]

    # Simple protocol: agent reads JSON request on stdin, may emit tool calls;
    # for MVP we embed the coding agent loop in-process via import when possible.
    agent_module = Path(cmd[-1]) if cmd else None
    if agent_module and agent_module.name == "agent.py":
        sys.path.insert(0, str(agent_module.parent))
        from agent import handle_run  # type: ignore

        return handle_run(claim["input"], gateway, state_path)

    payload = json.dumps({"input": claim["input"], "contract": contract})
    proc = subprocess.run(cmd, input=payload, capture_output=True, text=True, env=env, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or "Agent process failed")
    return json.loads(proc.stdout or "{}")


def process_one(cp: ControlPlaneClient, workspace: str) -> bool:
    pending = cp.pending()
    if not pending:
        return False
    run_meta = pending[0]
    claim = cp.claim(run_meta["id"])
    state_path = Path(workspace) / ".agentos" / "runs" / claim["id"]
    state_path.mkdir(parents=True, exist_ok=True)
    connectors = build_connectors(workspace)
    gateway = ExecutionGateway(cp, connectors, claim["id"])

    # Resume path: if state has pending approval
    resume_file = state_path / "pending_approval.json"
    if resume_file.exists():
        gateway.pending_approval = json.loads(resume_file.read_text())
        try:
            result = gateway.resume_after_approval()
            # Continue agent after write
            sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "examples" / "coding-agent"))
            from agent import continue_after_write  # type: ignore

            output = continue_after_write(claim["input"], gateway, state_path, result)
            cp.complete(claim["id"], {"ok": True, "output": output, "cost_estimate": 0.02, "token_usage": 120})
            resume_file.unlink(missing_ok=True)
            return True
        except PermissionError as exc:
            cp.complete(claim["id"], {"ok": False, "error": str(exc)})
            return True

    try:
        output = run_process_agent(claim, gateway, state_path)
        cp.complete(claim["id"], {"ok": True, "output": output, "cost_estimate": 0.05, "token_usage": 350})
    except ApprovalRequired as exc:
        if gateway.pending_approval:
            resume_file.write_text(json.dumps(gateway.pending_approval))
        # Leave run in waiting_approval — do not complete
        print(f"Run {claim['id']} waiting approval {exc.approval_id}")
    except Exception as exc:
        cp.complete(claim["id"], {"ok": False, "error": str(exc)})
        print(f"Run {claim['id']} failed: {exc}")
    return True


def main() -> None:
    base = os.environ.get("AGENTOS_API_URL", "http://127.0.0.1:8080")
    token = os.environ.get("AGENTOS_RUNNER_TOKEN", "dev-runner-token")
    workspace = os.environ.get("AGENTOS_WORKSPACE", str(Path(__file__).resolve().parents[1] / "examples" / "demo-repo"))
    Path(workspace).mkdir(parents=True, exist_ok=True)
    # Ensure demo repo is a git repo
    if not (Path(workspace) / ".git").exists():
        subprocess.run(["git", "init"], cwd=workspace, check=False, capture_output=True)
        subprocess.run(["git", "config", "user.email", "agentos@local"], cwd=workspace, check=False, capture_output=True)
        subprocess.run(["git", "config", "user.name", "AgentOS"], cwd=workspace, check=False, capture_output=True)

    cp = ControlPlaneClient(base, token)
    print(f"AgentOS runner watching {base} workspace={workspace}")
    once = os.environ.get("AGENTOS_RUNNER_ONCE") == "1"
    while True:
        worked = process_one(cp, workspace)
        if once:
            break
        time.sleep(1.0 if not worked else 0.2)


if __name__ == "__main__":
    main()
