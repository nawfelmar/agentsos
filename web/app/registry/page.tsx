"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader } from "../components/ui";

export default function RegistryPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/agents")
      .then(setAgents)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <>
      <PageHeader
        title="Agent registry"
        lede="Container-registry style inventory of versions, environments, and promotions — framework-agnostic."
      />
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Latest</th>
                <th>Deployed</th>
                <th>Environment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.name}>
                  <td>
                    <strong>{a.name}</strong>
                    <div className="event-meta">{a.description || "No description"}</div>
                  </td>
                  <td><span className="badge">{a.latest_version || "—"}</span></td>
                  <td><span className="badge accent">{a.deployed_version || "—"}</span></td>
                  <td>{a.environment || "—"}</td>
                  <td><Link href={`/agents/${a.name}`}>Manage</Link></td>
                </tr>
              ))}
              {!agents.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="Registry empty" body="Register an agent contract with agentctl or the API." />
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
