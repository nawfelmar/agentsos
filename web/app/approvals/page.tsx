"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const data = await api("/approvals?status_filter=pending");
    setItems(data);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  async function decide(id: string, decision: "approve" | "reject", runId: string) {
    setMsg("");
    await api(`/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    if (decision === "approve") {
      await api(`/runs/${runId}/resume`, { method: "POST" });
    }
    setMsg(`${decision}d ${id}`);
    await refresh();
  }

  return (
    <>
      <h1>Approvals</h1>
      <p className="sub">Human gates for high-risk tool actions. Decisions are audited.</p>
      {msg && <p className="badge ok">{msg}</p>}
      {items.length === 0 && <p className="sub">No pending approvals.</p>}
      {items.map((a) => (
        <div className="panel" key={a.id}>
          <h3>
            {a.action.toUpperCase()} · {a.resource}
          </h3>
          <p>
            Agent <span className="badge">{a.agent_name}</span> · Risk{" "}
            <span className={`badge ${a.risk === "HIGH" ? "warn" : ""}`}>{a.risk}</span>
          </p>
          <p className="sub">{a.reason}</p>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            {JSON.stringify(a.args, null, 2)}
          </pre>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button className="btn" onClick={() => decide(a.id, "approve", a.run_id)}>
              Approve
            </button>
            <button className="btn secondary" onClick={() => decide(a.id, "reject", a.run_id)}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
