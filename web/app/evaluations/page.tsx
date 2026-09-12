"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function EvaluationsPage() {
  const [evals, setEvals] = useState<any[]>([]);

  useEffect(() => {
    api("/evaluations").then(setEvals).catch(console.error);
  }, []);

  return (
    <>
      <h1>Evaluations</h1>
      <p className="sub">Regression evidence across agent versions — framework-agnostic.</p>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Version</th>
              <th>Suite</th>
              <th>Score</th>
              <th>Regression</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {evals.map((e) => (
              <tr key={e.id}>
                <td>{e.agent}</td>
                <td>
                  <span className="badge">{e.version}</span>
                </td>
                <td>{e.suite}</td>
                <td>{e.score}%</td>
                <td>
                  <span className={`badge ${e.regression === "PASS" ? "ok" : e.regression === "FAIL" ? "bad" : ""}`}>
                    {e.regression}
                  </span>
                </td>
                <td>{e.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
