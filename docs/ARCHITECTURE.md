# AgentOS architecture

**Positioning:** The security and control layer for autonomous AI.

Create agents wherever you want. AgentOS controls what they are actually allowed to do.

AgentOS is **not** an LLM, chatbot, agent framework, IDE, or generic orchestrator. It is infrastructure to identify, authenticate, authorize, control, observe, audit, evaluate, isolate, suspend, and terminate autonomous AI agents — regardless of model, framework, vendor, or runtime.

---

## Critical rule

**No AI component is a security authority.**

```
HUMAN / ORGANIZATION
        ↓
DETERMINISTIC POLICY AUTHORITY
        ↓
IDENTITY + AUTHORIZATION
        ↓
ACTION / TOOL GATEWAY
        ↓
ENTERPRISE SYSTEMS
```

Authentication, authorization, capability checks, policy evaluation, credential issuance/revocation, network restrictions, tool permissions, human approvals, runtime isolation, kill switch, and audit integrity remain **deterministic** and independently enforceable.

An optional AI supervisor may recommend. It must never decide.

**Core must work with every AI component removed.**

---

## Control plane vs execution plane

| Plane | Owns | Runs where |
|-------|------|------------|
| **Control plane** | Identity, registration, policy, approvals, lifecycle, audit, eval metadata, kill | AgentOS service (customer-controlled or local) |
| **Execution plane** | Agents, tools, code, workloads, sensitive data | Customer Docker/K8s/VM/on-prem |

Sensitive customer data does not need to leave the customer environment merely because AgentOS is used.

---

## Integration modes (agents may be created outside AgentOS)

AgentOS cannot magically see every process everywhere. Enforcement uses explicit boundaries:

| Mode | Mechanism |
|------|-----------|
| **A — SDK** | Cooperative agent calls AgentOS SDK / tool-gate |
| **B — Sidecar** | AgentOS sidecar beside the workload (roadmap) |
| **C — Action gateway** | Agents reach Git/Jira/CI/cloud only via gated connectors |
| **D — Network** | Firewalls, NetworkPolicies, mesh, API gateways, cloud IAM |

Strongest guarantee: protected resources are configured so autonomous workloads cannot reach them except through enforceable boundaries.

Shadow / unregistered workload detection is **telemetry-dependent** (Phase 4). Do not claim universal agent discovery.

---

## Phase 1 enforcement loop (shipped MVP)

```
Agent requests action
        ↓
Authenticate runner / workload
        ↓
Canonical resource mapping (ignore agent-supplied labels)
        ↓
Deterministic policy (ALLOW | DENY | APPROVAL_REQUIRED)
        ↓
Optional human approval
        ↓
Mint short-lived, single-use capability grant + HMAC permit
        ↓
Pre-execute ledger check (kill-revoked grants fail here)
        ↓
Connector execute (refuses without permit; honors revoke)
        ↓
Consume grant + audit tool.executed
```

Kill / containment (operator or security team):

1. Stop authorizing new actions (terminal run status)
2. Reject open approvals
3. **Revoke outstanding capability grants**
4. Block pre-execute / connector use of revoked permits
5. Preserve forensic telemetry + audit `CONTAINMENT`

The agent does not get to refuse. AI is not the authority over its own termination.

---

## Optional AI supervisor (Phase 5 — plugin only)

```
Telemetry → Supervisor interface → structured risk recommendation
                    ↓
         Deterministic AgentOS core (ALLOW/DENY / CONTAIN)
```

Supervisor must not: modify policies, grant unrestricted credentials, disable audit/kill, override human rejection, or authorize production access alone.

If supervisor is enabled, require structured outputs (objective, evidence, risk, confidence, recommended_action) — not raw chain-of-thought.

---

## Open-source vs commercial (intent)

**Open-source core:** protocol, SDK, CLI, policy engine, local control plane, action gateway, audit/event format, core connectors, evaluation harness.

**Commercial candidates later:** fleet management, SSO/RBAC, advanced compliance audit, managed control plane, enterprise connectors, optional AI supervision, support/SLA.

Do not build billing before product-market validation.

---

## Build order

1. **Enforcement** — identity, registration, capabilities, policy, gateway, credentials, isolation, kill  
2. **Observability** — events, audit, live activity, fleet, security events  
3. **Lifecycle** — versions, deploy, rollback, eval, approvals  
4. **Shadow AI** — telemetry ingest, unknown workload correlation  
5. **Optional AI supervision** — plugin only, after deterministic core works  

---

## Explicit non-goals

- Proprietary LLM / chatbot / agent framework / IDE / workflow engine  
- Replacing full SIEM, IAM, EDR, or container orchestrators  
- Premature microservices, Kafka, or dozens of connectors  
- Hard-coding automotive domain into the core (policy packs/connectors stay separate)
