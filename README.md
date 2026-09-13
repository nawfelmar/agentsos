# AgentOS

**The security and control layer for autonomous AI.**

Create agents wherever you want. AgentOS controls what they are actually allowed to do.

Your AI can decide what it wants to do. **AgentOS decides whether it is allowed to act.**

AgentOS is a framework-agnostic **control plane and security boundary** for heterogeneous agents (coding, test, DevOps, vendor, custom) — not an LLM, chatbot, agent framework, or IDE.

Core value does **not** require an AI supervisor. Deterministic identity, policy, action gateway, credentials, audit, and kill switch stand alone.

| Step | What it means |
|------|----------------|
| **1. Register** | Stable agent identity separate from the underlying model |
| **2. Capabilities + policy** | Explicit allow/deny/approval — outside the LLM |
| **3. Action gateway** | Tools run only with short-lived capability permits |
| **4. Run privately** | Execution stays on customer infra |
| **5. Observe + audit** | Every request, decision, and containment event |
| **6. Approve / revoke / kill** | Humans remain the ultimate authority |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Verified MVP demo

1. Register `coding-agent@1.0.0`
2. Deploy with policies (`jira.read`/`git.read` ALLOW, `git.write` APPROVAL_REQUIRED)
3. Run with Jira ticket `AUTO-42`
4. Policy blocks write → human approval → write executes
5. Rogue attempts (e.g. secrets / denied actions) → POLICY DENIED + audit
6. Operator kill → grants revoked; further execute blocked
7. Evaluation + deploy/rollback

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

CLI:

```bash
python cli/agentctl.py login --organization acme-auto --email admin@acme.local --password agentos-demo --register
python cli/agentctl.py register examples/coding-agent/agent.yaml
python cli/agentctl.py deploy coding-agent --env local --seed-policies
python cli/agentctl.py list
```

## Enterprise UI

| Surface | Purpose |
|---------|---------|
| Overview | Mission control — KPIs, approvals, recent activity |
| Registry | Register BYO agents; versions like images |
| Agent detail | Deploy, rollback, start governed run |
| Live view | Timeline, policy decisions, inline approvals, stop |
| Policies | ALLOW / DENY / APPROVAL_REQUIRED |
| Approvals | Human gate for risky actions |
| Audit | Tamper-evident security + governance log |
| Evaluations | Safety/performance checks before promote |

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
| `examples/` | Reference agents (not the product) |

## Explicit non-goals

Not an OpenHands / CrewAI / LangGraph / Cursor / chatbot / foundation-model product. Optional AI supervision is a future plugin — never a dependency for Core.
