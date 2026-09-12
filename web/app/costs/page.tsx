"use client";

import Link from "next/link";
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
  const sorted = [...rows].sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));

  return (
    <>
      <PageHeader
        title="Cost & usage"
        lede="Agent economics for private and hosted inference — runs, estimated cost, and fleet rollups."
        actions={<Link className="btn secondary sm" href="/runs">Open runs</Link>}
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
                <th>Share</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const share = total ? (Number(r.cost || 0) / total) * 100 : 0;
                return (
                  <tr key={r.agent}>
                    <td>
                      <Link href={`/agents/${encodeURIComponent(r.agent)}`}><strong>{r.agent}</strong></Link>
                    </td>
                    <td>{r.runs}</td>
                    <td>€{Number(r.cost || 0).toFixed(2)}</td>
                    <td>
                      <div className="cost-bar" title={`${share.toFixed(1)}%`}>
                        <span style={{ width: `${Math.max(share, share > 0 ? 4 : 0)}%` }} />
                      </div>
                      <span className="event-meta">{share.toFixed(0)}%</span>
                    </td>
                    <td><Link href="/runs">Runs</Link></td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr><td colSpan={5}><EmptyState title="No usage yet" body="Costs appear after runs complete." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
