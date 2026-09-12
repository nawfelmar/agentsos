"""Reference CodingAgent — demonstrates BYO agent under AgentOS governance.

This is an EXAMPLE, not the product. It speaks the execution gateway
(tool calls) and does not embed a proprietary framework.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol


class Gateway(Protocol):
    def call(self, tool: str, action: str, args: dict[str, Any], reason: str | None = None, risk: str = "MEDIUM") -> dict[str, Any]: ...


def handle_run(input_data: dict[str, Any], gateway: Gateway, state_path: Path) -> dict[str, Any]:
    ticket_key = input_data.get("ticket") or input_data.get("jira_key") or "AUTO-42"
    state_path.mkdir(parents=True, exist_ok=True)

    # Step: investigate Jira
    issue = gateway.call("jira", "get_issue", {"key": ticket_key}, reason="Load ticket context", risk="LOW")
    (state_path / "issue.json").write_text(json.dumps(issue, indent=2))

    # Step: investigate repo
    files = gateway.call("git", "list_files", {"pattern": "**/*"}, reason="Inventory repository", risk="LOW")
    thresholds = None
    if any(f.endswith("thresholds.yaml") or f.endswith("thresholds.yml") for f in files.get("files", [])):
        path = next(f for f in files["files"] if f.endswith("thresholds.yaml") or f.endswith("thresholds.yml"))
        thresholds = gateway.call("git", "read_file", {"path": path}, reason="Read thresholds config", risk="LOW")
    else:
        # Ensure demo file exists for investigation narrative
        path = "src/thresholds.yaml"
        thresholds = {"path": path, "content": "brake_pressure_warning_bar: 3.0\n"}

    (state_path / "investigation.json").write_text(
        json.dumps({"ticket": ticket_key, "files": files.get("files", []), "thresholds": thresholds}, indent=2)
    )

    # Propose fix based on ticket description heuristic
    new_content = "brake_pressure_warning_bar: 2.5\n"
    proposal = {
        "path": thresholds.get("path", "src/thresholds.yaml"),
        "content": new_content,
        "summary": f"Align brake pressure warning threshold with {ticket_key} (2.5 bar)",
    }
    (state_path / "proposal.json").write_text(json.dumps(proposal, indent=2))

    # This write is expected to hit APPROVAL_REQUIRED under demo policy
    write_result = gateway.call(
        "git",
        "write_file",
        {"path": proposal["path"], "content": proposal["content"]},
        reason=proposal["summary"],
        risk="HIGH",
    )
    return continue_after_write(input_data, gateway, state_path, write_result)


def continue_after_write(
    input_data: dict[str, Any],
    gateway: Gateway,
    state_path: Path,
    write_result: dict[str, Any],
) -> dict[str, Any]:
    proposal = json.loads((state_path / "proposal.json").read_text())
    issue = json.loads((state_path / "issue.json").read_text()) if (state_path / "issue.json").exists() else {}
    diff = gateway.call("git", "diff", {"path": proposal["path"]}, reason="Show resulting diff", risk="LOW")
    status = gateway.call("git", "status", {}, reason="Confirm working tree", risk="LOW")
    return {
        "ticket": input_data.get("ticket", "AUTO-42"),
        "issue_summary": (issue.get("issue") or {}).get("summary"),
        "change": proposal,
        "write": write_result,
        "diff": diff.get("diff"),
        "status": status.get("status"),
        "message": "Code change applied after policy approval",
    }


if __name__ == "__main__":
    # Standalone dry-run not connected to control plane
    print(json.dumps({"error": "Run via AgentOS runner"}, indent=2))
