"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/runs").then(setRuns).catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <>
      <h1>Runs</h1>
      <p className="sub">Observable executions — status, cost, timeline. No fake chain-of-thought.</p>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Version</th>
              <th>Status</th>
              <th>Cost</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.agent_name}</td>
                <td>
                  <span className="badge">{r.version}</span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      r.status === "succeeded" ? "ok" : r.status === "failed" ? "bad" : "warn"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td>€{Number(r.cost_estimate || 0).toFixed(2)}</td>
                <td>{r.created_at}</td>
                <td>
                  <Link href={`/runs/${r.id}`}>Timeline</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
