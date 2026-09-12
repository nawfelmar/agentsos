"""Thin Python SDK for AgentOS control plane."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import yaml


class AgentOSClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8080", token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        with httpx.Client(base_url=self.base_url, headers=self._headers(), timeout=60.0) as c:
            r = c.request(method, path, **kwargs)
            if r.status_code >= 400:
                raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text}")
            if r.status_code == 204:
                return None
            return r.json()

    def register_org(self, organization: str, email: str, name: str, password: str) -> dict:
        data = self._request(
            "POST",
            "/api/v1/auth/register",
            json={"organization": organization, "email": email, "name": name, "password": password},
        )
        self.token = data["access_token"]
        return data

    def login(self, organization: str, email: str, password: str) -> dict:
        data = self._request(
            "POST",
            "/api/v1/auth/login",
            json={"organization": organization, "email": email, "password": password},
        )
        self.token = data["access_token"]
        return data

    def register_agent_file(self, path: str | Path, tags: list[str] | None = None) -> dict:
        contract = yaml.safe_load(Path(path).read_text())
        return self._request("POST", "/api/v1/agents/register", json={"contract": contract, "tags": tags or []})

    def deploy(self, agent: str, environment: str = "local", version: str | None = None, seed_demo_policies: bool = False) -> dict:
        return self._request(
            "POST",
            f"/api/v1/agents/{agent}/deploy",
            json={"environment": environment, "version": version, "seed_demo_policies": seed_demo_policies},
        )

    def rollback(self, agent: str, environment: str = "local") -> dict:
        return self._request("POST", f"/api/v1/agents/{agent}/rollback", json={"environment": environment})

    def create_run(self, agent: str, input_data: dict | None = None, environment: str = "local") -> dict:
        return self._request(
            "POST",
            "/api/v1/runs",
            json={"agent": agent, "environment": environment, "input": input_data or {}},
        )

    def get_run(self, run_id: str) -> dict:
        return self._request("GET", f"/api/v1/runs/{run_id}")

    def list_agents(self) -> list:
        return self._request("GET", "/api/v1/agents")

    def list_approvals(self, status_filter: str | None = "pending") -> list:
        params = {"status_filter": status_filter} if status_filter else None
        return self._request("GET", "/api/v1/approvals", params=params)

    def decide_approval(self, approval_id: str, decision: str) -> dict:
        return self._request("POST", f"/api/v1/approvals/{approval_id}/decide", json={"decision": decision})

    def resume_run(self, run_id: str) -> dict:
        return self._request("POST", f"/api/v1/runs/{run_id}/resume")

    def evaluate(self, agent: str, version: str, suite_name: str = "default", baseline_version: str | None = None) -> dict:
        return self._request(
            "POST",
            "/api/v1/evaluations",
            json={"agent": agent, "version": version, "suite_name": suite_name, "baseline_version": baseline_version},
        )

    def list_policies(self, agent: str | None = None) -> list:
        params = {"agent": agent} if agent else None
        return self._request("GET", "/api/v1/policies", params=params)
