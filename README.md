# AgentOS

Open-source **control plane** for enterprise AI agents.

> Bring your agents. Run them under our control plane.

AgentOS is **not** an agent framework. It is infrastructure for registering, deploying, authorizing, observing, evaluating, and rolling back heterogeneous agents on private execution planes.

See [docs/ARCHITECTURE_ASSESSMENT.md](docs/ARCHITECTURE_ASSESSMENT.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Verified MVP demo

The thesis loop has been run successfully in this environment:

1. Register `coding-agent@1.0.0`
2. Deploy to local execution with policies (`jira.read`/`git.read` ALLOW, `git.write` APPROVAL_REQUIRED)
3. Run with Jira ticket `AUTO-42`
4. Policy blocks write → human approval → write executes
5. Full observable timeline in control plane
6. Evaluation score 100%
7. Deploy v2 → compare regression PASS → rollback to v1

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=$PWD
export AGENTOS_WORKSPACE=$PWD/examples/demo-repo

# Terminal A — control plane
uvicorn controlplane.app:app --host 127.0.0.1 --port 8080

# Terminal B — execution plane runner
python -m runner.main

# Terminal C — prove the thesis
python scripts/demo_mvp.py

# Optional UI
cd web && npm install && npm run dev
# http://localhost:3000 — register org acme-auto / admin@acme.local / agentos-demo
```

CLI (same venv, `PYTHONPATH` set):

```bash
python cli/agentctl.py login --organization acme-auto --email admin@acme.local --password agentos-demo --register
python cli/agentctl.py register examples/coding-agent/agent.yaml
python cli/agentctl.py deploy coding-agent --env local --seed-policies
python cli/agentctl.py list
```

## Enterprise UI

Open http://localhost:3000 after `cd web && npm install && npm run build && npm run start`.

| Surface | Purpose |
|---------|---------|
| Overview | Fleet KPIs, pending approvals, recent runs/evals |
| Registry | Agent inventory, versions, environments |
| Agent detail | Deploy, rollback, start governed run |
| Runs / Timeline | Observable events (policy, tools, approvals) |
| Approvals | Human gates for high-risk tool actions |
| Policies | ALLOW / DENY / APPROVAL_REQUIRED rules |
| Evaluations | Version scores and regression |
| Audit | Control-plane action history |
| Costs | Per-agent run economics |

Login demo: org `acme-auto` · `admin@acme.local` · `agentos-demo`

## What we own

Lifecycle: **Register → Identify → Configure → Authorize → Test → Deploy → Run → Observe → Evaluate → Audit → Roll back**

What we do **not** own: agent internal reasoning or orchestration.

## Layout

| Path | Role |
|------|------|
| `protocol/` | Agent contract & event schemas |
| `controlplane/` | Registry, policy, approvals, runs, eval, audit |
| `runner/` | Private execution plane |
| `connectors/` | Policy-gated Git / Jira / HTTP |
| `sdk/` | Thin Python SDK |
| `cli/` | `agentctl` |
| `web/` | Control-plane UI |
| `examples/` | Reference agents & templates (not the product) |

## Explicit non-goals

Not an OpenHands / CrewAI / LangGraph / Cursor / chatbot / foundation-model product.
