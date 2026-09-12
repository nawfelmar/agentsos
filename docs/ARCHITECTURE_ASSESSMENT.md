# AgentOS — Architecture Reassessment

**Date:** 2026-09-12  
**Status:** Greenfield — no prior codebase linked to this run  
**Working name:** AgentOS

## 0. Inspection result

This Cloud Agent run has **no repository checkout** (`repoUrl: null`, empty `/agent` workspace). There is no existing OpenHands/CrewAI/LangGraph-style implementation to delete.

**Consequence:** Keep/delete mapping is N/A. We start from a blank slate and refuse to recreate “another agent framework.”

---

## 1. Product thesis (locked)

AgentOS is an **open-source, framework-agnostic control plane** for running enterprise AI agents securely across private infrastructure.

| We are | We are not |
|--------|------------|
| Kubernetes / Actions / Terraform **for agents** | The best agent |
| Lifecycle + governance infrastructure | An agent framework |
| Bring-your-own-agent | Rewrite-for-us |
| Control plane ≠ execution plane | SaaS that must see private data |

**Positioning line:** *The open-source control plane for enterprise AI agents.*

---

## 2. Target architecture (three layers)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTROL PLANE (product)                      │
│  Registry · Identity · Versions · Deploy · Policy · Approvals   │
│  Eval · Observability metadata · Audit · Cost · Lifecycle        │
│                         FastAPI monolith                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ Agent Protocol (HTTP/gRPC later)
                             │ metadata / status / audit / metrics only
┌────────────────────────────▼────────────────────────────────────┐
│                   EXECUTION PLANE (customer)                     │
│  Runner (Docker/process) · sandboxes · local/customer models     │
│  Private data stays here · customer decides egress               │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│   CONNECTORS (scoped)     │   │  FRAMEWORK ADAPTERS (later)     │
│  Git · Jira · HTTP · MCP  │   │  OpenHands · LangGraph · CrewAI │
│  least-privilege scopes   │   │  Generic HTTP Agent (MVP)       │
└───────────────────────────┘   └─────────────────────────────────┘
```

### Lifecycle we own

```
REGISTER → IDENTIFY → CONFIGURE → AUTHORIZE → TEST → DEPLOY
    → RUN → OBSERVE → EVALUATE → AUDIT → ROLL BACK
```

We do **not** own internal agent reasoning/orchestration.

---

## 3. Keep / delete / refactor (against imaginary prior art)

If a prior build looked like a chatbot, IDE, or agent framework, treat it as conflict.

| Category | Disposition |
|----------|-------------|
| Agent “brains”, planners, multi-agent crews, graph DSLs | **Delete / never build** |
| Chat playground, CoT UI, prompt IDE | **Delete / never build** |
| RAG/vector DB product surface | **Delete / never build** |
| Registry, policy, approvals, runs, audit, eval harness | **Keep / build first** |
| Docker runner + generic protocol | **Keep / build first** |
| Thin example agents (automotive templates) | **Keep as examples only** — not core |
| Per-framework adapters | **Defer** — generic protocol only for MVP |

---

## 4. Competitive risks (top 5)

1. **LangSmith / Langfuse / Helicone gravity** — Observability alone is not differentiation; without registry + policy + deploy + eval as one lifecycle, we look like another tracer.
2. **Platform teams build “internal AgentOps”** — Large enterprises may assemble registry + OPA + CI themselves; we must be faster to value and genuinely BYO-agent.
3. **Framework vendors add governance** — OpenHands / CrewAI / MS Agent Framework may ship policy & deploy features; our bet is remaining framework-agnostic.
4. **Cloud hyperscalers** — Azure AI Foundry / Bedrock Agents / Vertex Agent Builder bundle control + execution; our wedge is **private execution + open control plane**.
5. **Positioning drift** — Sales/demo pressure to “just ship a great coding agent” collapses us into OpenHands/Cursor territory and kills the category.

---

## 5. Technical risks (top 5)

1. **Protocol adoption** — If wrapping existing agents is painful, nobody brings agents; the generic contract must be thin and boring.
2. **Policy at the tool boundary** — Enforcement must be in the execution plane (not UI-only); bypass = governance theater.
3. **Sensitive data leakage** — Control plane must default to metadata-only; redaction + configurable egress is security-critical.
4. **Non-deterministic replay** — Must not overpromise; record enough for forensics, label replay as best-effort.
5. **Sandbox escape / connector blast radius** — Docker + scoped credentials + no host FS / unrestricted shell; threat-model the runner early.

---

## 6. Overlap check (OpenHands / CrewAI / LangSmith)

| Capability | OpenHands | CrewAI | LangSmith | AgentOS (target) |
|------------|-----------|--------|-----------|------------------|
| Agent reasoning / coding loop | Core | Core | No | **Out of scope** |
| Multi-agent orchestration | Partial | Core | No | **Out of scope** |
| Tracing / eval | Light | Light | Core | **Part of lifecycle** |
| Cross-framework registry | No | No | Weak | **Core** |
| Policy + human approval at tool calls | Weak | Weak | No | **Core** |
| Deploy / promote / rollback agents | No | No | No | **Core** |
| Private execution, SaaS metadata only | Varies | Varies | Often SaaS-centric | **Core principle** |

**Still-too-close traps to avoid in MVP:**
- Building a coding agent product UX
- Shipping a graph/crew DSL
- Making eval “prompt playground”
- Requiring our SDK for agent internals (adapters wrap; agents stay themselves)

---

## 7. Smallest MVP that proves differentiation

**One thesis to prove:**

> A company can take an existing agent, deploy it into private infrastructure, give it controlled access to enterprise tools, observe every action, evaluate it, and manage its lifecycle from one control plane.

### In scope (must be real)

| Component | MVP slice |
|-----------|-----------|
| Control plane | Orgs, users (JWT), agents, versions, deployments, policies, runs, events, approvals, evaluations, audit |
| Execution | Local process runner + Docker runner interface; OpenAI-compatible + stub local model |
| Protocol | Generic Agent Contract + run loop (start → tool_request → policy → approve? → tool_result → complete) |
| Connectors | Git (local repo), Jira (mock or real API), generic HTTP — all policy-gated |
| UI | Registry, Agent detail, Deploy, Runs, Timeline, Approvals, Policies, Evaluations |
| CLI | `agentctl register|deploy|run|logs|evaluate|rollback` |
| Demo | CodingAgent template: Jira ticket → repo investigate → write blocked → approve → write → eval → v2 → compare → rollback |

### Explicitly out of MVP

- Kubernetes, microservices split, air-gap installer
- Full OpenHands/LangGraph/CrewAI adapters
- Billing, SSO, advanced RBAC
- Foundation models, chat IDE, RAG product
- Fake CoT displays

### Success demo (must work end-to-end)

1. Register CodingAgent v1.0  
2. Deploy to local execution  
3. Policy: Jira READ, Git READ, Git WRITE → APPROVAL_REQUIRED  
4. Run with Jira ticket  
5. Agent investigates repo  
6. Agent proposes write  
7. Policy blocks write → approval request  
8. Human approves  
9. Write executes  
10. Timeline shows all events  
11. Evaluation runs  
12. Deploy v2, compare scores  
13. Rollback  

---

## 8. Monorepo layout (planned)

```
agentos/
  packages/protocol/     # Agent contract schemas (JSON Schema / Pydantic)
  controlplane/          # FastAPI modular monolith + Postgres/SQLite
  runner/                # Execution plane worker
  connectors/            # git, jira, http
  sdk/python/            # thin client for agents & runner
  cli/                   # agentctl
  web/                   # Next.js control UI
  examples/coding-agent/ # reference BYO agent (not the product)
  tests/
  docker-compose.yml
```

**Boring stack:** Python · FastAPI · SQLAlchemy · Postgres (SQLite for local smoke) · Docker when available · React/Next.js · REST · JWT.

---

## 9. Critical product test (ongoing)

For every feature: *Does this help at 10 / 100 / 1,000 heterogeneous agents?*  
If no → challenge. If yes → place in control plane / execution / policy / observability / evaluation / connector — never into “another framework.”

---

## 10. Implementation status (this repo)

Greenfield MVP landed as a modular monolith:

| Slice | Status |
|-------|--------|
| Architecture assessment | Done — `docs/ARCHITECTURE_ASSESSMENT.md` |
| Agent contract (`protocol/`) | Done |
| Control plane API | Done — registry, deploy, policy, runs, approvals, eval, audit, costs |
| Execution runner | Done — process runner + policy gate (Docker not required for MVP proof) |
| Connectors | Done — Git (sandboxed), Jira (mock/real), HTTP allowlist |
| CodingAgent example | Done — proves BYO agent under governance |
| Automotive templates | Done — YAML stubs only under `examples/templates/` |
| CLI `agentctl` | Done |
| Web UI | Done — registry, detail/deploy, runs/timeline, approvals, policies, evals |
| E2E thesis demo | **Verified** via `scripts/demo_mvp.py` |
| Unit/API tests | **9 passed** |

Deferred (intentionally): framework adapters, Kubernetes, billing, SSO, air-gap pack, Docker runtime (interface-ready; process runner used where Docker unavailable).
