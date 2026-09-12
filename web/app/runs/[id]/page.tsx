"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { StatusBadge, formatTime, shortId } from "../../components/ui";

type Filter = "all" | "tools" | "policy" | "approvals" | "errors";

function clock(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function runtimeLabel(createdAt?: string | null) {
  if (!createdAt) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

function isLiveStatus(status?: string) {
  const s = (status || "").toLowerCase();
  return s.includes("wait") || s.includes("run") || s === "pending";
}

function eventKind(type: string): Filter | "agent" {
  const t = (type || "").toLowerCase();
  if (t.includes("fail") || t.includes("error") || t.includes("denied") || t.includes("reject") || t.includes("stopped")) {
    return "errors";
  }
  if (t.includes("approval")) return "approvals";
  if (t.includes("policy")) return "policy";
  if (t.includes("tool") || t.includes("file") || t.includes("command")) return "tools";
  return "agent";
}

function eventIcon(type: string, status?: string | null) {
  const t = (type || "").toLowerCase();
  const s = (status || "").toLowerCase();
  if (t.includes("approval") && (s.includes("pending") || t.includes("requested"))) return "!";
  if (t.includes("fail") || t.includes("error") || s.includes("deny") || s.includes("reject") || t.includes("stopped")) {
    return "×";
  }
  if (t.includes("policy")) return "P";
  if (t.includes("tool") || t.includes("file") || t.includes("command")) return "✓";
  return "◆";
}

function eventTone(type: string, status?: string | null, policy?: any) {
  const t = (type || "").toLowerCase();
  const s = (status || "").toLowerCase();
  const effect = String(policy?.effect || "").toUpperCase();
  if (t.includes("fail") || t.includes("error") || t.includes("stopped") || s.includes("deny") || s.includes("reject") || effect === "DENY") {
    return "bad";
  }
  if (t.includes("approval") || effect.includes("APPROVAL") || s.includes("pending") || s.includes("waiting")) return "warn";
  if (t.includes("policy") || t.includes("tool") || t.includes("completed") || s.includes("ok") || s.includes("success") || effect === "ALLOW") {
    return "ok";
  }
  return "info";
}

function eventTitle(e: any) {
  const t = String(e.type || "event");
  const tool = e.tool ? String(e.tool) : "";
  if (t.includes("approval.requested")) return "Approval requested";
  if (t.includes("approval.decided")) return "Approval decided";
  if (t.includes("policy")) return "Policy check";
  if (t.includes("tool.executed")) return tool || "Tool executed";
  if (t.includes("tool.requested")) return tool ? `${tool} requested` : "Tool requested";
  if (t.includes("tool.returned")) return tool ? `${tool} returned` : "Tool returned";
  if (t.includes("agent.started")) return "Agent started";
  if (t.includes("agent.completed")) return "Agent completed";
  if (t.includes("agent.stopped")) return "Agent stopped";
  if (t.includes("run.created")) return "Run created";
  return t;
}

function eventDetail(e: any) {
  const meta = e.metadata || {};
  const policy = e.policy_decision;
  if (policy?.effect) {
    return `${policy.resource || meta.resource || e.tool || "resource"} → ${policy.effect}${
      policy.reason ? ` · ${policy.reason}` : ""
    }`;
  }
  if (meta.action && meta.resource) return `${String(meta.action).toUpperCase()} ${meta.resource}`;
  if (meta.action) return String(meta.action).replaceAll("_", " ");
  if (meta.reason) return meta.reason;
  if (meta.stopped_by) return `Stopped by ${meta.stopped_by}`;
  if (e.status) return String(e.status);
  return "—";
}

function currentTask(run: any, events: any[]) {
  const input = run.input || {};
  const ticket = input.ticket || input.issue || input.jira || input.task || Object.values(input)[0];
  const last = [...events].reverse().find((e) => e.type && !String(e.type).includes("run.created"));
  return {
    headline: ticket ? `Investigate ${ticket}` : `Run ${shortId(run.id)}`,
    quote:
      run.output?.issue_summary ||
      run.output?.message ||
      (typeof ticket === "string" ? `Find root cause / complete work for ${ticket}` : JSON.stringify(input || {})),
    current: last ? eventDetail(last) : "Waiting for first event",
  };
}

function permissionState(effect?: string) {
  const e = (effect || "").toUpperCase();
  if (e === "ALLOW") return { label: "allow", tone: "ok", mark: "✓" };
  if (e === "DENY") return { label: "deny", tone: "bad", mark: "✕" };
  if (e.includes("APPROVAL")) return { label: "approval", tone: "warn", mark: "!" };
  return { label: "unset", tone: "muted", mark: "·" };
}

export default function AgentLiveViewPage() {
  const params = useParams();
  const id = params.id as string;

  const [run, setRun] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [, setTick] = useState(0);

  async function refresh() {
    const data = await api(`/runs/${id}`);
    setRun(data);
    const [ag, pols, aps] = await Promise.all([
      api(`/agents/${data.agent_name}`).catch(() => null),
      api("/policies").catch(() => []),
      api("/approvals").catch(() => []),
    ]);
    setAgent(ag);
    setPolicies(Array.isArray(pols) ? pols.filter((p: any) => p.agent_name === data.agent_name) : []);
    setApprovals((Array.isArray(aps) ? aps : []).filter((a: any) => a.run_id === id));
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        await refresh();
        if (alive) setError("");
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    }
    load();
    const poll = setInterval(load, 2000);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const events: any[] = run?.events || [];

  const filtered = useMemo(() => {
    const base = showAllEvents ? events : events.slice(-14);
    const list = [...base].reverse();
    if (filter === "all") return list;
    return list.filter((e) => eventKind(e.type) === filter);
  }, [events, filter, showAllEvents]);

  const task = run ? currentTask(run, events) : null;
  const errorEvents = events.filter(
    (e) => eventKind(e.type) === "errors" || String(e.policy_decision?.effect || "").toUpperCase() === "DENY",
  );
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const versionContract =
    agent?.versions?.find((v: any) => v.version === run?.version)?.contract || agent?.versions?.[0]?.contract || {};
  const model = versionContract.model || {};
  const caps: string[] = versionContract.capabilities || [];

  const cost = Number(run?.cost_estimate ?? 0);
  const tokens = Number(run?.token_usage ?? 0);
  const gpuCost = Number((cost * 0.22).toFixed(2));
  const modelCost = Number(Math.max(0, cost - gpuCost).toFixed(2));
  const live = isLiveStatus(run?.status);

  const permRows = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of caps) map.set(c, "ALLOW");
    for (const p of policies) {
      if (!run?.environment || p.environment === run.environment) map.set(p.resource, p.effect);
    }
    const preferred = [
      "jira.read",
      "jira.write",
      "git.read",
      "git.write",
      "git.delete",
      "http.request",
      "secrets.access",
    ];
    const keys = [...new Set([...preferred.filter((k) => map.has(k)), ...map.keys()])];
    return keys.map((resource) => ({ resource, effect: map.get(resource) }));
  }, [caps, policies, run?.environment]);

  async function decide(approvalId: string, decision: "approve" | "reject") {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await api(`/approvals/${approvalId}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
      if (decision === "approve") {
        await api(`/runs/${id}/resume`, { method: "POST" });
      }
      setMsg(decision === "approve" ? "Approved — run resumed" : "Rejected — run stopped");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function stopAgent() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await api(`/runs/${id}/stop`, { method: "POST" });
      setMsg("Agent stopped");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !run) return <div className="error-banner">{error}</div>;
  if (!run) return <p className="lede">Loading agent live view…</p>;

  return (
    <div className={`live-view${live ? " is-live" : ""}`}>
      <div className="live-crumb">
        <Link href="/">AgentOS</Link>
        <span>/</span>
        <Link href="/registry">Agents</Link>
        <span>/</span>
        <Link href={`/agents/${run.agent_name}`}>{run.agent_name}</Link>
        <span>/</span>
        <span className="mono">v{run.version}</span>
      </div>

      <header className="live-header">
        <div className="live-header-main">
          <div className={`live-pulse ${live ? "on" : ""}`} aria-hidden />
          <div>
            <div className="live-status-row">
              <StatusBadge status={run.status} />
              <span className="mono live-run-id">Run #{shortId(run.id)}</span>
              <span className="live-started">Started {clock(run.created_at)}</span>
              <span className="live-runtime mono">{runtimeLabel(run.created_at)}</span>
            </div>
            <h1 className="live-title">
              {run.agent_name} <span className="live-ver">v{run.version}</span>
            </h1>
          </div>
        </div>
        <div className="live-header-actions">
          <Link className="btn secondary sm" href="/runs">
            All runs
          </Link>
          <button className="btn danger sm" disabled={busy || !live} onClick={stopAgent}>
            Stop agent
          </button>
        </div>
      </header>

      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="live-top-grid">
        <div className="live-card status-card">
          <div className="live-card-label">Status</div>
          <div className="live-status-big">
            <span className={`live-dot ${live ? "pulse" : ""}`} />
            {(run.status || "unknown").replaceAll("_", " ")}
          </div>
          <dl className="live-kv">
            <div>
              <dt>Runtime</dt>
              <dd className="mono">{runtimeLabel(run.created_at)}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd className="mono">{run.version}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>
                {model.provider || model.model ? `${model.provider || "customer"}/${model.model || "—"}` : "—"}
              </dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{run.environment || "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="live-card task-card">
          <div className="live-card-label">Current task</div>
          <h2>{task?.headline}</h2>
          <p className="live-quote">{task?.quote || "No task summary yet"}</p>
          <div className="live-current">
            <span className="live-card-label">Current</span>
            <strong>{task?.current}</strong>
          </div>
        </div>
      </section>

      <section className="live-card activity-card">
        <div className="live-card-hd">
          <div>
            <h2>Live activity</h2>
            <p>CCTV for the agent — immutable events, not chatbot tokens.</p>
          </div>
          <div className="live-filters">
            {(
              [
                ["all", "All"],
                ["tools", "Tools"],
                ["policy", "Policy"],
                ["approvals", "Approvals"],
                ["errors", "Errors"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={filter === key ? "on" : ""} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <ol className="live-timeline">
          {filtered.map((e) => {
            const tone = eventTone(e.type, e.status, e.policy_decision);
            const active = selected?.id === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={`live-event ${tone}${active ? " selected" : ""}`}
                  onClick={() => setSelected(e)}
                >
                  <time>{clock(e.timestamp)}</time>
                  <span className={`live-event-icon ${tone}`}>{eventIcon(e.type, e.status)}</span>
                  <span className="live-event-body">
                    <span className="live-event-title">{eventTitle(e)}</span>
                    <span className="live-event-detail">{eventDetail(e)}</span>
                  </span>
                  <span className="live-event-dur mono">
                    {e.duration_ms != null ? `${e.duration_ms}ms` : (e.type || "").split(".").pop()}
                  </span>
                </button>
              </li>
            );
          })}
          {!filtered.length ? <li className="live-empty">No events for this filter.</li> : null}
        </ol>

        <div className="live-timeline-foot">
          <button type="button" className="btn secondary sm" onClick={() => setShowAllEvents((v) => !v)}>
            {showAllEvents ? "Show recent activity" : "View full timeline"}
          </button>
          <span className="mono">{events.length} events</span>
        </div>
      </section>

      <section className="live-split">
        <div className="live-card">
          <div className="live-card-label">Cost & usage</div>
          <dl className="live-cost">
            <div>
              <dt>Tokens</dt>
              <dd className="mono">{tokens.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Model cost</dt>
              <dd className="mono">€{modelCost.toFixed(2)}</dd>
            </div>
            <div>
              <dt>GPU runtime</dt>
              <dd className="mono">€{gpuCost.toFixed(2)}</dd>
            </div>
            <div className="total">
              <dt>Total</dt>
              <dd className="mono">€{cost.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Avg / run</dt>
              <dd className="mono">€{cost.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
        <div className="live-card">
          <div className="live-card-label">Errors</div>
          {errorEvents.length === 0 && !run.error ? (
            <div className="live-empty-inline">No errors on this run.</div>
          ) : (
            <ul className="live-errors">
              {run.error ? (
                <li>
                  <strong>Run error</strong>
                  <span>{run.error}</span>
                </li>
              ) : null}
              {errorEvents
                .slice(-3)
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    <strong>{eventTitle(e)}</strong>
                    <span>{eventDetail(e)}</span>
                    <button type="button" className="linkish" onClick={() => setSelected(e)}>
                      View
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      <section className="live-card approvals-card">
        <div className="live-card-label">Approvals</div>
        {!pendingApprovals.length ? (
          <div className="live-empty-inline">
            {approvals.length
              ? "No pending approvals — history is in the Approvals console."
              : "No approval gates on this run."}
          </div>
        ) : (
          pendingApprovals.map((a) => (
            <div className="live-approval" key={a.id}>
              <div className="live-approval-hd">
                <StatusBadge status="waiting_approval" />
                <span className="mono">{clock(a.created_at)}</span>
              </div>
              <h3>
                {a.action} · {a.resource}
              </h3>
              <p>{a.reason || "Policy requires human authorization before tool execution."}</p>
              <div className="live-approval-meta">
                Policy: {a.resource} · Risk <StatusBadge status={a.risk} />
              </div>
              <pre className="pre">{JSON.stringify(a.args || {}, null, 2)}</pre>
              <div className="split-actions">
                <button className="btn secondary" disabled={busy} onClick={() => decide(a.id, "reject")}>
                  Reject
                </button>
                <button className="btn" disabled={busy} onClick={() => decide(a.id, "approve")}>
                  Approve
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="live-card">
        <div className="live-card-label">Permissions</div>
        <div className="perm-grid">
          {permRows.map((row) => {
            const st = permissionState(row.effect);
            return (
              <div className={`perm-cell ${st.tone}`} key={row.resource}>
                <span className="perm-name">{row.resource}</span>
                <span className="perm-mark">{st.mark}</span>
                <span className="perm-label">{st.label}</span>
              </div>
            );
          })}
          {!permRows.length ? <div className="live-empty-inline">No capabilities or policies recorded.</div> : null}
        </div>
      </section>

      {selected ? (
        <div className="evidence-backdrop" onClick={() => setSelected(null)}>
          <aside className="evidence-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="evidence-hd">
              <div>
                <div className="live-card-label">Event evidence</div>
                <h2>{eventTitle(selected)}</h2>
              </div>
              <button className="btn secondary sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <dl className="evidence-kv">
              <div>
                <dt>Agent</dt>
                <dd>
                  {run.agent_name} v{run.version}
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd className="mono">{selected.type}</dd>
              </div>
              <div>
                <dt>Tool</dt>
                <dd>{selected.tool || "—"}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd className="mono">{selected.metadata?.action || "—"}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd className="mono">{formatTime(selected.timestamp)}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{selected.policy_decision?.effect || "—"}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd className="mono">{selected.duration_ms != null ? `${selected.duration_ms}ms` : "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={selected.status} />
                </dd>
              </div>
              <div>
                <dt>Resource</dt>
                <dd className="mono">{selected.metadata?.resource || selected.policy_decision?.resource || "—"}</dd>
              </div>
              <div>
                <dt>Redacted</dt>
                <dd>{selected.redacted ? "yes" : "no"}</dd>
              </div>
            </dl>
            <div className="live-card-label" style={{ marginTop: "1rem" }}>
              Sanitized payload
            </div>
            <pre className="pre">
              {JSON.stringify(
                {
                  metadata: selected.metadata || {},
                  policy: selected.policy_decision || null,
                  status: selected.status,
                },
                null,
                2,
              )}
            </pre>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
