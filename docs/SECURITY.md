# AgentOS security model — the agent is untrusted

## Claim (precise)

**AgentOS does not guarantee that an agent will behave.**

**AgentOS limits what an agent can actually do, independently of what the agent decides to do.**

The agent is the worker. Deterministic AgentOS policy is the authority. The agent can request. AgentOS decides. The infrastructure enforces.

Assume agents hallucinate, get prompt-injected, escalate, and fail. Never trust the AI. Trust policies, identities, least privilege, scoped credentials, gated actions, isolation, immutable audit, and human authority.

## Core without AI

Identity, registration, authentication, capability authorization, policy evaluation, action gateway, credential lifecycle, isolation hooks, human approvals, audit, lifecycle, suspension, termination, and kill switch **must not require an LLM**.

## Enforcement flow

```
Agent
  ↓
Action request
  ↓
AgentOS enforcement layer (control plane tool-gate)
  ↓
Policy evaluation (outside the LLM)
  ├── DENY     → block + audit (policy.violation)
  ├── APPROVAL → pause + human decision
  └── ALLOW    → mint single-use capability grant
                    ↓
              Pre-execute ledger check
                    ↓
              Connector execute
                    ↓
              Consume grant + audit
```

Critical authorization is **never** implemented merely as a system prompt.

## Kill switch (containment)

Stop is a security operation, not a UI status change:

| Step | Behavior |
|------|----------|
| Stop new actions | Run status terminal → tool-gate DENY |
| Reject approvals | Pending approvals rejected |
| Revoke credentials | Outstanding `CapabilityGrant` rows get `revoked_at` |
| Block execute | `/runner/capability-check` + connector ledger check refuse revoked permits |
| Preserve evidence | Run events + audit (`run.stop`, `credential.revoke`, `CONTAINMENT`) |

HMAC permits may remain cryptographically valid until TTL; the **grant ledger** is authoritative after kill.

## Defense in depth (MVP → target)

| Control | MVP status |
|---------|------------|
| External policy gate before tools | **Enforced** — `POST /runner/tool-gate` |
| Server-canonical resource mapping | **Enforced** — agent-supplied resource cannot escalate |
| Capability permits for connectors | **Enforced** — connectors refuse without HMAC permit |
| Grant ledger + single-use consume | **Enforced** |
| Pre-execute check after kill | **Enforced** — `POST /runner/capability-check` |
| Kill revokes outstanding grants | **Enforced** |
| Forge `tool.executed` via events API | **Blocked** |
| Human approval for high-risk writes | **Enforced** |
| Audit of denies / spoof / containment | **Enforced** |
| Workspace path jail / HTTP allowlist | **Enforced** at connector |
| Runtime isolation (container/VM) | **Partial** — process runner; container next |
| Short-lived least-privilege secrets | **Partial** — permits short-lived; vault/KMS next |
| Strong agent identity (mTLS/SPIFFE) | **Not yet** — shared runner bearer today |
| Network egress / sidecar / mesh | **Not yet** — Mode D integrations |
| Shadow workload detection | **Not yet** — telemetry-dependent Phase 4 |
| Optional AI supervisor | **Not built** — must remain a plugin |

## Bypass-resistance tests

See `tests/test_bypass_resistance.py`:

- ignore assigned permissions
- spoof policy resource
- invoke connector without permit
- forge execution events
- obtain credentials / secrets.access
- continue after kill switch
- **use outstanding permit after kill (revoked)**
- reuse consumed capability permit

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Host FS escape via git | Path resolve under workspace; reject `..` |
| Arbitrary shell | No shell connector in MVP |
| Unrestricted HTTP | Host allowlist on HTTP connector |
| Policy bypass in UI | UI cannot authorize tools |
| Race: mint then kill then execute | Revoke grants + pre-execute ledger check |
| Cooperative-only gateway | Connectors require permits; Mode D later |
| Cross-tenant access | Org-scoped control-plane queries |
| Runner spoofing | Shared runner token (replace with mTLS/SPIFFE) |
| Rogue optional supervisor | Cannot be policy/credential/kill authority |

## Not yet (architect toward)

- Sidecar + network enforcement modes
- Air-gapped install packs
- Per-connector credential vault (KMS)
- Signed agent artifacts / workload identity
- Immutable WORM audit store
- Full container/VM sandbox with no host FS/network by default
