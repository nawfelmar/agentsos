# AgentOS security model — the agent is untrusted

## Claim (precise)

**AgentOS does not guarantee that an agent will behave.**

**AgentOS limits what an agent can actually do, independently of what the agent decides to do.**

The agent is the worker. AgentOS is the authority. The agent can request. AgentOS decides. The infrastructure enforces.

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
  └── ALLOW    → issue single-use capability permit → connector may execute
```

Critical authorization is **never** implemented merely as a system prompt.

## Defense in depth (MVP → target)

| Control | MVP status |
|---------|------------|
| External policy gate before tools | **Enforced** — `POST /runner/tool-gate` |
| Server-canonical resource mapping | **Enforced** — agent-supplied resource cannot escalate |
| Capability permits for connectors | **Enforced** — connectors refuse without HMAC permit |
| Single-use permit consume on tool-result | **Enforced** |
| Forge `tool.executed` via events API | **Blocked** |
| Human approval for high-risk writes | **Enforced** |
| Operator kill switch | **Enforced** — stop blocks further permits + completion overwrite |
| Audit of denies / spoof attempts | **Enforced** — `policy.violation` |
| Workspace path jail / HTTP allowlist | **Enforced** at connector |
| Runtime isolation (container/VM) | **Partial** — process runner; container runtime next |
| Short-lived least-privilege credentials | **Partial** — permits are short-lived; vault/KMS next |
| Strong agent identity (mTLS/SPIFFE) | **Not yet** — shared runner bearer today |
| Network egress policy beyond connector | **Not yet** |

## Bypass-resistance tests

See `tests/test_bypass_resistance.py` for infrastructure-level cases:

- ignore assigned permissions
- spoof policy resource
- invoke connector without permit
- forge execution events
- obtain credentials / secrets.access
- continue after kill switch
- reuse consumed capability permit

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Host FS escape via git | Path resolve under workspace; reject `..` |
| Arbitrary shell | No shell connector in MVP |
| Unrestricted HTTP | Host allowlist on HTTP connector |
| Policy bypass in UI | UI cannot authorize tools |
| Cooperative-only gateway | Connectors require capability permits |
| Cross-tenant access | Org-scoped control-plane queries |
| Runner spoofing | Shared runner token (replace with mTLS/SPIFFE) |

## Not yet (architect toward)

- Air-gapped install packs
- Per-connector credential vault (KMS)
- Network policies / egress proxies
- Signed agent artifacts
- Immutable WORM audit store
- Full container/VM sandbox with no host FS/network by default
