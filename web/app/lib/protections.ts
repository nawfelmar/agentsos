/** Human-readable “you were protected” copy for policy blocks. */

export type ProtectionEvent = {
  id?: string;
  actor?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
  timestamp?: string;
  // run-event shaped
  type?: string;
  tool?: string;
  status?: string;
  policy_decision?: { effect?: string; reason?: string; resource?: string };
  metadata?: Record<string, any>;
};

export function isProtectionAudit(e: { action?: string; details?: Record<string, any> }) {
  if (e.action === "policy.violation") return true;
  if (e.details?.security_event === "POLICY_VIOLATION") return true;
  return false;
}

export function isProtectionRunEvent(e: ProtectionEvent) {
  const effect = String(e.policy_decision?.effect || e.status || "").toUpperCase();
  if (effect === "DENY") return true;
  const t = String(e.type || "").toLowerCase();
  return t.includes("policy.violation") || t.includes("agent.stopped") || t.includes("kill");
}

export function protectionHeadline(e: ProtectionEvent): string {
  const d = e.details || e.metadata || {};
  const tool = d.tool || e.tool || "tool";
  const action = d.action || d.attempted || "";
  const resource = d.resource || d.canonical_resource || e.policy_decision?.resource || "";
  const reason = String(d.reason || e.policy_decision?.reason || "").toLowerCase();

  if (reason.includes("spoof") || d.resource_spoof_attempt || d.client_resource) {
    return "Blocked privilege spoof";
  }
  if (reason.includes("stopped") || reason.includes("kill") || String(e.type || "").includes("stopped")) {
    return "Kill switch held";
  }
  if (reason.includes("forge") || String(d.event_type || "").includes("tool.executed")) {
    return "Blocked forged execution claim";
  }
  if (String(resource).includes("secret") || String(tool).includes("secret")) {
    return "Blocked secrets access";
  }
  if (String(resource).includes("delete") || String(action).includes("delete")) {
    return "Blocked destructive action";
  }
  if (String(resource).includes("write") || String(action).includes("write")) {
    return "Blocked unauthorized write";
  }
  return "Blocked unauthorized action";
}

export function protectionStory(e: ProtectionEvent): string {
  const d = e.details || e.metadata || {};
  const agent = String(e.actor || "").replace(/^agent:/, "") || "Agent";
  const tool = d.tool || e.tool || "a tool";
  const action = d.action || "";
  const resource = d.resource || d.canonical_resource || e.policy_decision?.resource || "a protected resource";
  const reason = d.reason || e.policy_decision?.reason || "No matching allow rule";

  if (d.client_resource && d.canonical_resource && d.client_resource !== d.canonical_resource) {
    return `${agent} asked for ${tool}.${action || "action"} but labeled it as ${d.client_resource}. AgentOS evaluated ${d.canonical_resource} and denied the request.`;
  }
  if (String(reason).toLowerCase().includes("stopped")) {
    return `Operator stopped the run. Further tool permits for ${agent} were refused.`;
  }
  if (String(d.event_type || "").includes("tool.executed") || String(reason).toLowerCase().includes("forge")) {
    return `${agent} tried to report a successful tool execution without a capability permit. The event was rejected.`;
  }
  return `${agent} requested ${tool}${action ? `.${action}` : ""} → ${resource}. Policy: DENY. ${reason}`;
}

export function protectionOutcome(): string {
  return "BLOCKED — no connector ran";
}
