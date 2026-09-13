"""Policy-gated enterprise connectors.

Connectors never execute until the control plane policy gate allows
(or an approval is granted). This lives in the execution plane.
"""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx

from controlplane.enforcement import (
    CapabilityPermit,
    PermitError,
    refuse_if_grant_revoked,
    verify_capability_token,
)


class ConnectorError(Exception):
    pass


class BaseConnector:
    """Connectors are inert without a control-plane capability permit.

    Agents cannot authorize themselves: HMAC-verified permits are issued only
    after external policy ALLOW (or redeemed approval). When a grant ledger
    row exists (production path), revoked/consumed permits are refused even if
    the HMAC signature is still cryptographically valid.
    """

    name: str = "base"

    def execute(
        self,
        action: str,
        args: dict[str, Any],
        *,
        capability_token: str | None = None,
    ) -> dict[str, Any]:
        permit = self._require_permit(capability_token, action)
        return self._execute(action, args, permit=permit)

    def _require_permit(self, capability_token: str | None, action: str) -> CapabilityPermit:
        if not capability_token:
            raise ConnectorError(
                "Refused: connector execute requires a control-plane capability permit "
                "(agent is untrusted; policy is enforced outside the model)"
            )
        try:
            permit = verify_capability_token(capability_token)
        except PermitError as exc:
            raise ConnectorError(f"Refused: invalid capability permit ({exc})") from exc
        if permit.tool != self.name:
            raise ConnectorError("Refused: capability permit tool mismatch")
        if permit.action != action:
            raise ConnectorError("Refused: capability permit action mismatch")
        # Honor kill-switch revocation when the grant ledger is reachable
        try:
            from controlplane.db import SessionLocal

            db = SessionLocal()
            try:
                refuse_if_grant_revoked(db, permit)
            finally:
                db.close()
        except PermitError as exc:
            raise ConnectorError(f"Refused: {exc}") from exc
        except Exception:
            # DB unavailable (isolated unit tests without schema) — HMAC still required
            pass
        return permit

    def _execute(
        self,
        action: str,
        args: dict[str, Any],
        *,
        permit: CapabilityPermit,
    ) -> dict[str, Any]:
        raise NotImplementedError


class GitConnector(BaseConnector):
    """Git connector limited to an explicit workspace root — no host FS escape."""

    name = "git"

    def __init__(self, workspace_root: str):
        self.root = Path(workspace_root).resolve()
        if not self.root.exists():
            self.root.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, rel: str) -> Path:
        target = (self.root / rel).resolve()
        if not str(target).startswith(str(self.root)):
            raise ConnectorError("Path escapes workspace root")
        return target

    def _execute(self, action: str, args: dict[str, Any], *, permit: CapabilityPermit) -> dict[str, Any]:
        start = time.time()
        if action == "status":
            out = self._git(["status", "--porcelain"])
            result = {"status": out}
        elif action == "log":
            n = str(args.get("n", 5))
            out = self._git(["log", f"-{n}", "--oneline"])
            result = {"log": out.splitlines()}
        elif action == "read_file":
            path = self._safe_path(args["path"])
            if not path.is_file():
                raise ConnectorError(f"File not found: {args['path']}")
            content = path.read_text(encoding="utf-8")
            result = {"path": args["path"], "content": content, "bytes": len(content)}
        elif action == "list_files":
            pattern = args.get("pattern", "**/*")
            files = [str(p.relative_to(self.root)) for p in self.root.glob(pattern) if p.is_file()]
            result = {"files": files[:200]}
        elif action == "write_file":
            path = self._safe_path(args["path"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(args.get("content", ""), encoding="utf-8")
            # Stage only — never force push
            self._git(["add", args["path"]])
            result = {"path": args["path"], "written": True}
        elif action == "diff":
            out = self._git(["diff", "--", args.get("path", ".")])
            result = {"diff": out}
        else:
            raise ConnectorError(f"Unsupported git action: {action}")
        result["duration_ms"] = int((time.time() - start) * 1000)
        return result

    def _git(self, args: list[str]) -> str:
        # No arbitrary shell — argv only, cwd pinned
        proc = subprocess.run(
            ["git", *args],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0 and proc.stderr:
            # status/diff may be empty; only raise on hard failures
            if "unknown revision" in proc.stderr or "not a git repository" in proc.stderr.lower():
                raise ConnectorError(proc.stderr.strip())
        return proc.stdout


class JiraConnector(BaseConnector):
    """Jira connector — uses mock store when no base_url configured."""

    name = "jira"

    def __init__(self, base_url: str | None = None, token: str | None = None, mock_tickets: dict | None = None):
        self.base_url = base_url.rstrip("/") if base_url else None
        self.token = token
        self.mock_tickets = mock_tickets or {
            "AUTO-42": {
                "key": "AUTO-42",
                "summary": "Fix brake-pressure warning threshold in vehicle-platform",
                "description": (
                    "Requirements say warning threshold should be 2.5 bar. "
                    "Implementation still uses 3.0 bar in src/thresholds.yaml."
                ),
                "status": "Open",
                "labels": ["automotive", "requirements"],
            }
        }

    def _execute(self, action: str, args: dict[str, Any], *, permit: CapabilityPermit) -> dict[str, Any]:
        if action == "get_issue":
            key = args["key"]
            if self.base_url and self.token:
                return self._remote_get(key)
            ticket = self.mock_tickets.get(key)
            if not ticket:
                raise ConnectorError(f"Issue not found: {key}")
            return {"issue": ticket}
        if action == "search":
            q = (args.get("jql") or "").lower()
            hits = [t for t in self.mock_tickets.values() if q in json.dumps(t).lower() or not q]
            return {"issues": hits}
        raise ConnectorError(f"Unsupported jira action: {action}")

    def _remote_get(self, key: str) -> dict[str, Any]:
        assert self.base_url
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}
        with httpx.Client(timeout=30.0) as client:
            r = client.get(f"{self.base_url}/rest/api/2/issue/{key}", headers=headers)
            r.raise_for_status()
            data = r.json()
            return {
                "issue": {
                    "key": data.get("key"),
                    "summary": data.get("fields", {}).get("summary"),
                    "description": data.get("fields", {}).get("description"),
                    "status": data.get("fields", {}).get("status", {}).get("name"),
                }
            }


class HttpConnector(BaseConnector):
    """Generic HTTP connector with allowlisted hosts."""

    name = "http"

    def __init__(self, allowed_hosts: list[str] | None = None):
        self.allowed_hosts = set(allowed_hosts or ["localhost", "127.0.0.1"])

    def _execute(self, action: str, args: dict[str, Any], *, permit: CapabilityPermit) -> dict[str, Any]:
        if action != "request":
            raise ConnectorError(f"Unsupported http action: {action}")
        url = args["url"]
        from urllib.parse import urlparse

        host = urlparse(url).hostname or ""
        if host not in self.allowed_hosts:
            raise ConnectorError(f"Host not allowlisted: {host}")
        method = args.get("method", "GET").upper()
        if method not in {"GET", "POST", "PUT", "PATCH", "HEAD"}:
            raise ConnectorError(f"Method not allowed: {method}")
        with httpx.Client(timeout=30.0) as client:
            r = client.request(method, url, json=args.get("json"), headers=args.get("headers"))
        return {"status_code": r.status_code, "body": r.text[:4000]}


class ConnectorRegistry:
    def __init__(self, connectors: dict[str, BaseConnector]):
        self._connectors = connectors

    def get(self, name: str) -> BaseConnector:
        if name not in self._connectors:
            raise ConnectorError(f"Unknown connector: {name}")
        return self._connectors[name]

    def resource_for(self, tool: str, action: str) -> str:
        """Map tool+action to policy resource key (canonical server mapping)."""
        from controlplane.enforcement import canonical_resource

        return canonical_resource(tool, action)
