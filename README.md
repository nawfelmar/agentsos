# AgentOS

**Bring your AI agents. AgentOS lets you run them safely, see what they did, and control what they’re allowed to touch.**

AgentOS is a **security desk + control room** for AI agents — not an agent framework and not a chatbot.

Companies run many AI helpers (coding bots, ticket investigators, release checkers). Those bots need Git, Jira, and internal systems. That’s risky if they can do anything they want.

AgentOS doesn’t build the smart bots. **It governs them.**

| Step | What it means |
|------|----------------|
| **1. Register** | “Here’s agent X, version 1.0” |
| **2. Set rules** | e.g. read Jira/Git freely; writing to Git needs a human OK |
| **3. Run privately** | Agent works on *your* machines/data — not dumped into a random SaaS |
| **4. Watch** | Every action logged: started, asked for a tool, blocked, approved, finished |
| **5. Approve risky moves** | Human clicks approve/reject before a write happens |
| **6. Test & roll back** | Score a new version; if it’s worse, go back to the old one |

### Simple analogy

If AI agents are employees, AgentOS is **HR + security badge system + CCTV + change-management** — not the employee’s brain.

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
# http://localhost:3000 — org acme-auto / admin@acme.local / agentos-demo
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
| Overview | Control room — KPIs, pending approvals, recent runs/evals |
| Registry | Register BYO agents (JSON contract), versions, environments |
| Agent detail | Deploy, rollback, start governed run |
| **Agent live view** (`/runs/[id]`) | Watch — CCTV timeline, badge checks, inline approvals, cost, stop |
| Runs | Fleet run list → opens live view |
| Approvals | Human OK before risky writes |
| Policies | Badge rules: ALLOW / DENY / APPROVAL_REQUIRED |
| Evaluations | Test & roll back |
| Audit | CCTV for the control plane |
| Costs | Per-agent run economics |

Login demo: org `acme-auto` · `admin@acme.local` · `agentos-demo`

## What we own

Lifecycle: **Register → Set rules → Run privately → Watch → Approve → Test & roll back**

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
