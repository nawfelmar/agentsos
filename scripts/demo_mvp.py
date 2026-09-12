#!/usr/bin/env python3
"""End-to-end demo proving the AgentOS thesis.

Steps:
  register → deploy → run → policy blocks write → approve → complete
  → evaluate → deploy v2 → compare → rollback
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "cli"))

from sdk import AgentOSClient

API = os.environ.get("AGENTOS_API_URL", "http://127.0.0.1:8080")


def wait_run(client: AgentOSClient, run_id: str, want: set[str], timeout: float = 60.0) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        run = client.get_run(run_id)
        if run["status"] in want:
            return run
        time.sleep(0.5)
    raise TimeoutError(f"Run {run_id} not in {want}; last={run['status']}")


def main() -> int:
    print("=== AgentOS MVP demo ===")
    client = AgentOSClient(API)

    # Auth
    try:
        client.register_org("acme-auto", "admin@acme.local", "Admin", "agentos-demo")
        print("Registered org acme-auto")
    except RuntimeError:
        client.login("acme-auto", "admin@acme.local", "agentos-demo")
        print("Logged in")

    # Reset demo repo file for clean write
    thresholds = ROOT / "examples" / "demo-repo" / "src" / "thresholds.yaml"
    thresholds.write_text("brake_pressure_warning_bar: 3.0\n")

    # Step 1 — register v1
    try:
        client.register_agent_file(ROOT / "examples" / "coding-agent" / "agent.yaml")
        print("Registered coding-agent@1.0.0")
    except RuntimeError as exc:
        if "409" not in str(exc):
            raise
        print("coding-agent@1.0.0 already registered")

    # Step 2 — deploy + policies
    dep = client.deploy("coding-agent", environment="local", version="1.0.0", seed_demo_policies=True)
    print(f"Deployed {dep['version']} → {dep['environment']}")

    policies = client.list_policies("coding-agent")
    print("Policies:", {p["resource"]: p["effect"] for p in policies})

    # Step 4-7 — run until approval
    run = client.create_run("coding-agent", {"ticket": "AUTO-42"}, environment="local")
    print(f"Run created {run['id']}")

    run = wait_run(client, run["id"], {"waiting_approval", "failed", "succeeded"})
    if run["status"] != "waiting_approval":
        print("ERROR: expected waiting_approval, got", run["status"], run.get("error"))
        print(json.dumps(run.get("events"), indent=2)[:2000])
        return 1
    print("Policy blocked git.write — approval required")

    # Step 8 — approve
    approvals = client.list_approvals("pending")
    assert approvals, "No pending approval"
    approval = approvals[0]
    client.decide_approval(approval["id"], "approve")
    client.resume_run(run["id"])
    print(f"Approved {approval['id']} and resumed run")

    # Step 9 — complete
    run = wait_run(client, run["id"], {"succeeded", "failed"}, timeout=60)
    if run["status"] != "succeeded":
        print("ERROR: run failed", run.get("error"))
        return 1
    print("Run succeeded after approval")

    # Step 10 — timeline
    types = [e["type"] for e in run["events"]]
    print("Timeline events:", types)
    for required in ("policy.evaluated", "approval.requested", "approval.decided", "tool.executed", "agent.completed"):
        if required not in types:
            print(f"ERROR: missing event {required}")
            return 1

    # Verify file changed
    content = thresholds.read_text()
    if "2.5" not in content:
        print("ERROR: thresholds not updated", content)
        return 1
    print("Repo updated under governance:", content.strip())

    # Step 11 — evaluate v1
    ev1 = client.evaluate("coding-agent", "1.0.0", suite_name="automotive-requirements")
    print(f"Eval v1.0.0 score={ev1['score']}%")

    # Step 12 — register+deploy v2
    try:
        client.register_agent_file(ROOT / "examples" / "coding-agent" / "agent.v2.yaml")
    except RuntimeError as exc:
        if "409" not in str(exc):
            raise
    client.deploy("coding-agent", environment="local", version="2.0.0")
    print("Deployed coding-agent@2.0.0")

    # Quick v2 run (thresholds already 2.5 — agent still writes; need approval again)
    # Reset to 3.0 to make write meaningful
    thresholds.write_text("brake_pressure_warning_bar: 3.0\n")
    run2 = client.create_run("coding-agent", {"ticket": "AUTO-42"}, environment="local")
    run2 = wait_run(client, run2["id"], {"waiting_approval"})
    a2 = client.list_approvals("pending")[0]
    client.decide_approval(a2["id"], "approve")
    client.resume_run(run2["id"])
    run2 = wait_run(client, run2["id"], {"succeeded", "failed"})
    assert run2["status"] == "succeeded"

    # Step 13 — compare evals
    ev2 = client.evaluate(
        "coding-agent",
        "2.0.0",
        suite_name="automotive-requirements",
        baseline_version="1.0.0",
    )
    print(f"Eval v2.0.0 score={ev2['score']}% regression={ev2['regression']}")

    # Step 14 — rollback
    rb = client.rollback("coding-agent", environment="local")
    print(f"Rolled back to {rb['version']} (from {rb['rolled_back_from']})")

    print("\n✓ Thesis proven: heterogeneous agent privately executed and centrally governed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
