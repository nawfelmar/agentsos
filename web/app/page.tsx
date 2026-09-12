"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./lib/api";


type Agent = {
  name: string;
  description?: string;
  latest_version?: string;
  deployed_version?: string;
  environment?: string;
};

export default function RegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Agent[]>("/agents")
      .then(setAgents)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <>
      <h1>Agent Registry</h1>
      <p className="sub">Versions, environments, promotion — not a chatbot gallery.</p>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Environment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td>
                  <span className="badge">{a.deployed_version || a.latest_version || "—"}</span>
                </td>
                <td>{a.environment || "—"}</td>
                <td>
                  <Link href={`/agents/${a.name}`}>Detail</Link>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={4}>No agents registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
