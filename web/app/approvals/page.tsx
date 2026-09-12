"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime } from "../components/ui";

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(nextFilter = filter) {
    const path = nextFilter === "pending" ? "/approvals?status_filter=pending" : "/approvals";
    setItems(await api(path));
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        if (!cancelled) await refresh();
      } catch (e: any) {
        if (!cancelled) setError(String(e.message || e));
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [filter]);

  async function decide(id: string, decision: "approve" | "reject", runId: string) {
    setBusy(id);
    setMsg("");
    setError("");
    try {
      await api(`/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
      if (decision === "approve") {
        await api(`/runs/${runId}/resume`, { method: "POST" });
      }
      setMsg(`${decision === "approve" ? "Approved" : "Rejected"} ${id.slice(0, 8)}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        lede="Approve or reject risky moves before they land — human OK required for gated writes. Every decision is audited."
        actions={
          <div className="seg">
            <button type="button" className={filter === "pending" ? "on" : ""} onClick={() => setFilter("pending")}>
              Pending
            </button>
            <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              All
            </button>
          </div>
        }
      />
      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {!items.length ? (
        <div className="panel">
          <div className="panel-bd">
            <EmptyState
              title={filter === "pending" ? "No pending approvals" : "No approvals yet"}
              body="Risky tool calls will appear here when policy requires human authorization."
            />
          </div>
        </div>
      ) : (
        items.map((a) => (
          <div className="approval-card" key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>
                  {a.action} · {a.resource}
                </h3>
                <div className="event-meta">
                  Agent <span className="badge accent">{a.agent_name}</span> · Risk <StatusBadge status={a.risk} /> ·{" "}
                  <StatusBadge status={a.status} /> · {formatTime(a.created_at)}
                  {a.decided_by ? (
                    <>
                      {" "}
                      · Decided by <strong>{a.decided_by}</strong>
                      {a.decided_at ? <> at {formatTime(a.decided_at)}</> : null}
                    </>
                  ) : null}
                </div>
              </div>
              <Link className="btn secondary sm" href={`/runs/${a.run_id}`}>
                View run
              </Link>
            </div>
            <p style={{ margin: "0.85rem 0", color: "var(--ink-2)" }}>{a.reason}</p>
            <pre className="pre">{JSON.stringify(a.args || {}, null, 2)}</pre>
            {a.status === "pending" ? (
              <div className="split-actions">
                <button className="btn" disabled={busy === a.id} onClick={() => decide(a.id, "approve", a.run_id)}>
                  Approve
                </button>
                <button className="btn secondary" disabled={busy === a.id} onClick={() => decide(a.id, "reject", a.run_id)}>
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
