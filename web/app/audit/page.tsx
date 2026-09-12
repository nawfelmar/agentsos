"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, formatTime, shortId } from "../components/ui";

function targetHref(type?: string, id?: string) {
  if (!type || !id) return null;
  if (type === "run") return `/runs/${id}`;
  if (type === "agent" || type === "agent_version") {
    const name = String(id).split("@")[0];
    return `/agents/${encodeURIComponent(name)}`;
  }
  return null;
}

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api("/audit")
      .then(setEvents)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const actions = useMemo(() => {
    const set = new Set(events.map((e) => e.action).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (!needle) return true;
      const hay = `${e.actor} ${e.action} ${e.target_type} ${e.target_id} ${JSON.stringify(e.details || {})}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [events, actionFilter, q]);

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
        lede="CCTV for the control plane — register, deploy, policy changes, approvals, evaluations, and rollbacks."
        actions={
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search actor, action, target…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter by action">
              {actions.map((a) => (
                <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>
              ))}
            </select>
            <button type="button" className="btn secondary sm" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </button>
          </div>
        }
      />
      {error ? <div className="error-banner">{error}</div> : null}
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
                const detailKeys = Object.keys(e.details || {});
                return (
                  <tr key={e.id}>
                    <td className="mono">{formatTime(e.timestamp)}</td>
                    <td>{e.actor}</td>
                    <td><span className="badge">{e.action}</span></td>
                    <td className="mono">
                      {href ? (
                        <Link href={href}>{e.target_type}:{shortId(String(e.target_id))}</Link>
                      ) : (
                        <>{e.target_type}:{String(e.target_id).slice(0, 24)}</>
                      )}
                    </td>
                    <td>
                      {detailKeys.length ? (
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
