# AgentOS MVP — Security notes

## Threat model (execution plane)

| Threat | Mitigation (MVP) |
|--------|------------------|
| Host filesystem escape via Git connector | Paths resolved under workspace root; reject `..` escapes |
| Arbitrary shell | No shell connector; git via argv-only subprocess |
| Unrestricted network | HTTP connector host allowlist |
| Secrets in control plane logs | Event ingest defaults `redacted=True`; arg redaction on approvals |
| Policy bypass in UI | Enforcement is in runner `tool_gate` before connector execute |
| Cross-tenant access | Org-scoped queries on all control-plane reads |
| Runner spoofing | Shared runner bearer token (replace with mTLS/SPIFFE later) |

## Principles

1. Control plane ≠ execution plane
2. Least privilege default (DENY)
3. Approvals for high-risk writes
4. Customer decides what leaves private infrastructure
5. Sandbox first — Docker runner interface next (process runner for environments without Docker)

## Not yet implemented (architect toward)

- Air-gapped install packs
- Per-connector credential vault encryption (KMS)
- Network policies / egress proxies
- Signed agent artifacts
- Immutable WORM audit store
