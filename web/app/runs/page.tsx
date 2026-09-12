"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime, shortId } from "../components/ui";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/runs").then(setRuns).catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <>
      <PageHeader
        title="Runs"
        lede="Open any run for the agent live view — forensic timeline, permissions, approvals, and cost. Not a chatbot."
      />
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Agent</th>
                <th>Env</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><Link className="mono" href={`/runs/${r.id}`}>{shortId(r.id)}</Link></td>
                  <td>{r.agent_name} <span className="badge">{r.version}</span></td>
                  <td>{r.environment}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>€{Number(r.cost_estimate || 0).toFixed(2)}</td>
                  <td className="mono">{formatTime(r.created_at)}</td>
                </tr>
              ))}
              {!runs.length ? (
                <tr><td colSpan={6}><EmptyState title="No runs" body="Start a governed run from an agent detail page." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
