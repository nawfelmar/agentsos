"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader } from "../components/ui";

export default function CostsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/costs")
      .then(setRows)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.cost || 0), 0);
  const runs = rows.reduce((s, r) => s + Number(r.runs || 0), 0);

  return (
    <>
      <PageHeader
        title="Cost & usage"
        lede="Agent economics for private and hosted inference — runs, estimated cost, and fleet rollups."
      />
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="stats">
        <div className="stat-card">
          <div className="label">Agents with usage</div>
          <div className="value">{rows.length}</div>
          <div className="hint">In this organization</div>
        </div>
        <div className="stat-card">
          <div className="label">Total runs</div>
          <div className="value">{runs}</div>
          <div className="hint">Recorded executions</div>
        </div>
        <div className="stat-card">
          <div className="label">Estimated cost</div>
          <div className="value">€{total.toFixed(2)}</div>
          <div className="hint">From run cost_estimate</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg / run</div>
          <div className="value">€{runs ? (total / runs).toFixed(3) : "0.000"}</div>
          <div className="hint">Fleet average</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hd"><h2>By agent</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Runs</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.agent}>
                  <td>{r.agent}</td>
                  <td>{r.runs}</td>
                  <td>€{Number(r.cost || 0).toFixed(2)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={3}><EmptyState title="No usage yet" body="Costs appear after runs complete." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
