"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);

  useEffect(() => {
    api("/policies").then(setPolicies).catch(console.error);
  }, []);

  return (
    <>
      <h1>Policies</h1>
      <p className="sub">Least privilege by default. ALLOW · DENY · APPROVAL_REQUIRED.</p>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Environment</th>
              <th>Resource</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>{p.agent_name}</td>
                <td>{p.environment}</td>
                <td>
                  <span className="badge">{p.resource}</span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      p.effect === "ALLOW" ? "ok" : p.effect === "DENY" ? "bad" : "warn"
                    }`}
                  >
                    {p.effect}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
