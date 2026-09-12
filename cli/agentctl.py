"""agentctl — AgentOS CLI."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import typer
import yaml
from rich import print as rprint
from rich.table import Table

from sdk import AgentOSClient

app = typer.Typer(help="AgentOS control plane CLI — govern agents, don't rewrite them.")
STATE_DIR = Path.home() / ".agentos"
STATE_FILE = STATE_DIR / "config.json"


def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"api_url": os.environ.get("AGENTOS_API_URL", "http://127.0.0.1:8080")}


def _save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def _client() -> AgentOSClient:
    state = _load_state()
    return AgentOSClient(base_url=state.get("api_url", "http://127.0.0.1:8080"), token=state.get("token"))


@app.command()
def login(
    organization: str = typer.Option(...),
    email: str = typer.Option(...),
    password: str = typer.Option(...),
    api_url: str = typer.Option("http://127.0.0.1:8080"),
    register: bool = typer.Option(False, help="Register org+user if missing"),
    name: str = typer.Option("Admin"),
) -> None:
    """Login (or register) to the control plane."""
    client = AgentOSClient(base_url=api_url)
    try:
        if register:
            data = client.register_org(organization, email, name, password)
        else:
            data = client.login(organization, email, password)
    except RuntimeError as exc:
        if not register and "401" in str(exc):
            rprint("[yellow]Login failed; try --register[/yellow]")
        raise typer.Exit(1) from exc
    state = {"api_url": api_url, "token": data["access_token"], "organization": organization, "email": email}
    _save_state(state)
    rprint(f"[green]Authenticated[/green] as {email} @ {organization}")


@app.command("register")
def register_agent(manifest: Path = typer.Argument(..., help="Path to agent.yaml contract")) -> None:
    """Register an agent version from a contract file."""
    client = _client()
    result = client.register_agent_file(manifest)
    rprint(f"[green]Registered[/green] {result['name']}@{result['version']}")


@app.command()
def deploy(
    agent: str = typer.Argument(...),
    env: str = typer.Option("local", "--env"),
    version: Optional[str] = typer.Option(None, "--version"),
    seed_policies: bool = typer.Option(False, "--seed-policies"),
) -> None:
    """Deploy an agent version to an environment."""
    client = _client()
    result = client.deploy(agent, environment=env, version=version, seed_demo_policies=seed_policies)
    rprint(f"[green]Deployed[/green] {result['agent']}@{result['version']} → {result['environment']}")


@app.command()
def run(
    agent: str = typer.Argument(...),
    input_json: str = typer.Option("{}", "--input"),
    env: str = typer.Option("local", "--env"),
) -> None:
    """Create a run (execution plane runner must be active)."""
    client = _client()
    payload = json.loads(input_json)
    result = client.create_run(agent, input_data=payload, environment=env)
    rprint(f"[green]Run created[/green] {result['id']} status={result['status']}")


@app.command()
def logs(run_id: str = typer.Argument(...)) -> None:
    """Show observable run timeline (not chain-of-thought)."""
    client = _client()
    run = client.get_run(run_id)
    table = Table(title=f"Run {run_id} — {run['status']}")
    table.add_column("Time")
    table.add_column("Event")
    table.add_column("Tool")
    table.add_column("Status")
    for e in run.get("events", []):
        table.add_row(e["timestamp"], e["type"], e.get("tool") or "", e.get("status") or "")
    rprint(table)


@app.command()
def evaluate(
    agent: str = typer.Argument(...),
    version: str = typer.Option(...),
    baseline: Optional[str] = typer.Option(None),
    suite: str = typer.Option("default"),
) -> None:
    """Run evaluation suite against recorded evidence."""
    client = _client()
    result = client.evaluate(agent, version, suite_name=suite, baseline_version=baseline)
    rprint(
        f"[green]Eval[/green] {result['agent']}@{result['version']} "
        f"score={result['score']}% regression={result['regression']}"
    )


@app.command()
def rollback(agent: str = typer.Argument(...), env: str = typer.Option("local", "--env")) -> None:
    """Roll back to previous deployment version."""
    client = _client()
    result = client.rollback(agent, environment=env)
    rprint(f"[green]Rolled back[/green] {result['agent']} {result['rolled_back_from']} → {result['version']}")


@app.command("list")
def list_agents() -> None:
    """List agents in the registry."""
    client = _client()
    agents = client.list_agents()
    table = Table(title="Agent Registry")
    table.add_column("Name")
    table.add_column("Version")
    table.add_column("Environment")
    for a in agents:
        table.add_row(a["name"], a.get("deployed_version") or a.get("latest_version") or "-", a.get("environment") or "-")
    rprint(table)


@app.command()
def approvals(decide: Optional[str] = typer.Option(None, help="Approval ID to approve")) -> None:
    """List pending approvals or approve one."""
    client = _client()
    if decide:
        result = client.decide_approval(decide, "approve")
        # Resume the run
        approvals = client.list_approvals(status_filter=None)
        # find run id from list — re-fetch pending won't have it; use decide response id
        # Get all and find
        all_a = client.list_approvals(status_filter="approved")
        match = next((a for a in all_a if a["id"] == decide), None)
        if match:
            client.resume_run(match["run_id"])
        rprint(f"[green]Approved[/green] {result['id']}")
        return
    items = client.list_approvals("pending")
    table = Table(title="Pending Approvals")
    table.add_column("ID")
    table.add_column("Agent")
    table.add_column("Resource")
    table.add_column("Risk")
    table.add_column("Reason")
    for a in items:
        table.add_row(a["id"], a["agent_name"], a["resource"], a["risk"], (a.get("reason") or "")[:60])
    rprint(table)


if __name__ == "__main__":
    app()
