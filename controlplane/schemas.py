"""API request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RegisterOrgRequest(BaseModel):
    organization: str
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    organization: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    organization: str
    user_id: str


class RegisterAgentRequest(BaseModel):
    contract: dict[str, Any]
    tags: list[str] = Field(default_factory=list)


class DeployRequest(BaseModel):
    environment: str = "local"
    name: str = "default"
    version: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    seed_demo_policies: bool = False


class RollbackRequest(BaseModel):
    environment: str = "local"
    name: str = "default"


class PolicyUpsert(BaseModel):
    agent_name: str
    environment: str = "local"
    resource: str
    effect: str
    conditions: dict[str, Any] = Field(default_factory=dict)


class CreateRunRequest(BaseModel):
    agent: str
    version: str | None = None
    deployment: str = "default"
    environment: str = "local"
    input: dict[str, Any] = Field(default_factory=dict)


class ApprovalDecision(BaseModel):
    decision: str  # approve | reject


class EventIngest(BaseModel):
    type: str
    tool: str | None = None
    status: str | None = None
    duration_ms: int | None = None
    policy_decision: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    redacted: bool = True


class ToolGateRequest(BaseModel):
    run_id: str
    tool: str
    action: str
    resource: str
    args: dict[str, Any] = Field(default_factory=dict)
    risk: str = "MEDIUM"
    reason: str | None = None


class ToolGateResponse(BaseModel):
    effect: str
    approval_id: str | None = None
    decision: dict[str, Any]
    message: str


class EvaluateRequest(BaseModel):
    suite_name: str = "default"
    agent: str
    version: str
    baseline_version: str | None = None


class AgentSummary(BaseModel):
    name: str
    version: str | None
    environment: str | None
    description: str | None = None


class RunOut(BaseModel):
    id: str
    agent_name: str
    version: str
    environment: str
    status: str
    input: dict[str, Any]
    output: dict[str, Any] | None
    cost_estimate: float
    created_at: datetime

    class Config:
        from_attributes = True
