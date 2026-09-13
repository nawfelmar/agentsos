"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../lib/api";
import { EmptyState, PageHeader, formatTime, shortId } from "../components/ui";
import {
  isProtectionAudit,
  protectionHeadline,
  protectionOutcome,
  protectionStory,
} from "../lib/protections";

function targetHref(type?: string, id?: string) {
  if (!type || !id) return null;
  if (type === "run") return `/runs/${id}`;
  if (type === "agent" || type === "agent_version") {
    const name = String(id).split("@")[0];
    return `/agents/${encodeURIComponent(name)}`;
  }
  return null;
}

export default function AuditClient() {
  const search = useSearchParams();
  const focusProtections = search.get("focus") === "protections";

  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState(focusProtections ? "policy.violation" : "all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api("/audit")
      .then(setEvents)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => {
    if (focusProtections) setActionFilter("policy.violation");
  }, [focusProtections]);

  const actions = useMemo(() => {
    const set = new Set(events.map((e) => e.action).filter(Boolean));
    return ["all", "policy.violation", ...Array.from(set).filter((a) => a !== "policy.violation").sort()];
  }, [events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (actionFilter === "policy.violation") return isProtectionAudit(e);
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (!needle) return true;
      const hay = `${e.actor} ${e.action} ${e.target_type} ${e.target_id} ${JSON.stringify(e.details || {})}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [events, actionFilter, q]);

  const protectionCount = events.filter(isProtectionAudit).length;

  function exportCsv() {
    const header = ["timestamp", "actor", "action", "target_type", "target_id", "details"];
    const lines = [header.join(",")];
    for (const e of filtered) {
      const row = [
        e.timestamp,
        e.actor,
        e.action,
        e.target_type,
        e.target_id,
        JSON.stringify(e.details || {}),
      ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`);
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agentos-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        lede="Proof of what agents attempted — and what AgentOS blocked. Denies, spoofs, kill-switch events, and governance changes."
        actions={
          <div className="toolbar">
            <button
              type="button"
              className={`btn sm ${actionFilter === "policy.violation" ? "" : "secondary"}`}
              onClick={() => setActionFilter("policy.violation")}
            >
              Protections ({protectionCount})
            </button>
            <input
              className="search"
              placeholder="Search actor, action, target…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter by action">
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a === "all" ? "All actions" : a === "policy.violation" ? "Protections only" : a}
                </option>
              ))}
            </select>
            <button type="button" className="btn secondary sm" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </button>
          </div>
        }
      />
      {error ? <div className="error-banner">{error}</div> : null}

      {actionFilter === "policy.violation" ? (
        <div className="protect-panel panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-hd">
            <h2>How you were protected</h2>
            <span className="badge bad">{filtered.length} blocked</span>
          </div>
          {filtered.length ? (
            <ul className="protect-list">
              {filtered.map((e) => (
                <li key={e.id} className="protect-item">
                  <div className="protect-item-hd">
                    <span className="protect-badge">PROTECTED</span>
                    <strong>{protectionHeadline(e)}</strong>
                    <time className="mono">{formatTime(e.timestamp)}</time>
                  </div>
                  <p>{protectionStory(e)}</p>
                  <div className="protect-item-ft">
                    <span className="protect-outcome">{protectionOutcome()}</span>
                    {e.target_type === "run" && e.target_id ? (
                      <Link className="mono" href={`/runs/${e.target_id}`}>
                        Open run {shortId(String(e.target_id))}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No protection events yet"
              body="Denied tools, resource spoofs, forged execution claims, and post–kill-switch attempts appear here."
            />
          )}
        </div>
      ) : null}

      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const href = targetHref(e.target_type, e.target_id);
                const protectedEvent = isProtectionAudit(e);
                const detailKeys = Object.keys(e.details || {});
                return (
                  <tr key={e.id} className={protectedEvent ? "row-protect" : undefined}>
                    <td className="mono">{formatTime(e.timestamp)}</td>
                    <td>{e.actor}</td>
                    <td>
                      <span className={`badge ${protectedEvent ? "bad" : ""}`}>{e.action}</span>
                    </td>
                    <td className="mono">
                      {href ? (
                        <Link href={href}>
                          {e.target_type}:{shortId(String(e.target_id))}
                        </Link>
                      ) : (
                        <>
                          {e.target_type}:{String(e.target_id).slice(0, 24)}
                        </>
                      )}
                    </td>
                    <td>
                      {protectedEvent ? (
                        <div className="audit-details">
                          <div className="event-meta">
                            <strong>{protectionHeadline(e)}</strong>
                          </div>
                          <div className="event-meta">{protectionStory(e)}</div>
                        </div>
                      ) : detailKeys.length ? (
                        <div className="audit-details">
                          {detailKeys.slice(0, 4).map((k) => (
                            <div key={k} className="event-meta">
                              <strong>{k}</strong> {String((e.details as any)[k]).slice(0, 80)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="event-meta">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title={events.length ? "No matching events" : "No audit events"}
                      body="Governance actions will appear here as the fleet operates."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
