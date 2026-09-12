"""AgentOS agent contract and event schemas.

The contract describes how an agent is registered and governed.
It does NOT prescribe how the agent reasons internally.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RuntimeType(str, Enum):
    CONTAINER = "container"
    PROCESS = "process"
    HTTP = "http"


class PolicyEffect(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EventType(str, Enum):
    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"
    TOOL_REQUESTED = "tool.requested"
    POLICY_EVALUATED = "policy.evaluated"
    TOOL_EXECUTED = "tool.executed"
    TOOL_RETURNED = "tool.returned"
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_DECIDED = "approval.decided"
    EVAL_STARTED = "eval.started"
    EVAL_COMPLETED = "eval.completed"
    COST_RECORDED = "cost.recorded"


class ResourceSpec(BaseModel):
    cpu: float | None = 1.0
    memory: str | None = "512Mi"


class RuntimeSpec(BaseModel):
    type: RuntimeType = RuntimeType.PROCESS
    image: str | None = None
    command: list[str] | None = None
    working_dir: str | None = None
    endpoint: str | None = None  # for HTTP adapters


class ModelSpec(BaseModel):
    provider: str = "customer-managed"
    model: str = "stub"
    base_url: str | None = None


class AgentContract(BaseModel):
    """Standard AgentOS agent contract (framework-agnostic)."""

    name: str
    version: str
    description: str | None = None
    runtime: RuntimeSpec = Field(default_factory=RuntimeSpec)
    model: ModelSpec = Field(default_factory=ModelSpec)
    capabilities: list[str] = Field(default_factory=list)
    policies: dict[str, Any] = Field(default_factory=dict)
    resources: ResourceSpec = Field(default_factory=ResourceSpec)
    labels: dict[str, str] = Field(default_factory=dict)
    entrypoint: str | None = None


class AgentIdentity(BaseModel):
    organization: str
    agent: str
    deployment: str
    version: str
    environment: str
    run_id: str | None = None


class PolicyRule(BaseModel):
    resource: str  # e.g. git.write, jira.read
    effect: PolicyEffect
    conditions: dict[str, Any] = Field(default_factory=dict)


class PolicyDecision(BaseModel):
    effect: PolicyEffect
    rule: str | None = None
    reason: str
    resource: str
    agent: str
    identity: AgentIdentity | None = None


class ToolRequest(BaseModel):
    tool: str
    action: str
    resource: str  # capability key, e.g. git.write
    args: dict[str, Any] = Field(default_factory=dict)
    risk: str = "MEDIUM"
    reason: str | None = None


class ToolResult(BaseModel):
    ok: bool
    output: Any = None
    error: str | None = None
    redacted: bool = False
    duration_ms: int | None = None


class ObservableEvent(BaseModel):
    type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    organization: str | None = None
    agent: str | None = None
    version: str | None = None
    deployment: str | None = None
    environment: str | None = None
    run_id: str | None = None
    tool: str | None = None
    status: str | None = None
    policy_decision: PolicyDecision | None = None
    duration_ms: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    # Sensitive values should already be redacted before leaving execution plane
    redacted: bool = False


class RunRequest(BaseModel):
    agent: str
    version: str | None = None
    deployment: str | None = None
    environment: str = "local"
    input: dict[str, Any] = Field(default_factory=dict)
    triggered_by: str | None = None


class EvaluationCase(BaseModel):
    id: str
    description: str
    input: dict[str, Any] = Field(default_factory=dict)
    expect_tools: list[str] = Field(default_factory=list)
    expect_no_policy_violations: bool = True
    expect_success: bool = True
    max_latency_ms: int | None = None


class EvaluationSuite(BaseModel):
    name: str
    agent: str
    version: str | None = None
    cases: list[EvaluationCase] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    suite: str
    agent: str
    version: str
    score: float
    passed: int
    failed: int
    total: int
    regression: str  # PASS | FAIL | N/A
    case_results: list[dict[str, Any]] = Field(default_factory=list)
