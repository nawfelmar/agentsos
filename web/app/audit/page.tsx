"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, formatTime } from "../components/ui";

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/audit")
      .then(setEvents)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <>
      <PageHeader
        title="Audit log"
        lede="Immutable-ish control-plane actions: register, deploy, policy changes, approvals, evaluations, and rollbacks."
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
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{formatTime(e.timestamp)}</td>
                  <td>{e.actor}</td>
                  <td><span className="badge">{e.action}</span></td>
                  <td className="mono">{e.target_type}:{String(e.target_id).slice(0, 12)}</td>
                  <td className="mono">{JSON.stringify(e.details || {})}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr><td colSpan={5}><EmptyState title="No audit events" body="Governance actions will appear here as the fleet operates." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
