"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime } from "../components/ui";

export default function EvaluationsPage() {
  const [evals, setEvals] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    agent: "coding-agent",
    version: "1.0.0",
    suite_name: "automotive-requirements",
    baseline_version: "",
  });

  async function refresh() {
    setEvals(await api("/evaluations"));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
  }, []);

  async function runEval() {
    setMsg("");
    setError("");
    try {
      const body: any = {
        agent: form.agent,
        version: form.version,
        suite_name: form.suite_name,
      };
      if (form.baseline_version) body.baseline_version = form.baseline_version;
      const res = await api("/evaluations", { method: "POST", body: JSON.stringify(body) });
      setMsg(`Score ${res.score}% · regression ${res.regression}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Evaluations"
        lede="Framework-agnostic regression evidence across agent versions — promote only what proves out."
      />
      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd"><h2>Results</h2></div>
          <div className="table-wrap">
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
                    <td><span className="badge">{e.version}</span></td>
                    <td>{e.suite}</td>
                    <td>{e.score}%</td>
                    <td><StatusBadge status={e.regression} /></td>
                    <td className="mono">{formatTime(e.created_at)}</td>
                  </tr>
                ))}
                {!evals.length ? (
                  <tr><td colSpan={6}><EmptyState title="No evaluations yet" body="Run a suite against recorded run evidence." /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><h2>Run evaluation</h2></div>
          <div className="panel-bd">
            <div className="field">
              <label>Agent</label>
              <input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} />
            </div>
            <div className="field">
              <label>Version</label>
              <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
            <div className="field">
              <label>Suite</label>
              <input value={form.suite_name} onChange={(e) => setForm({ ...form, suite_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Baseline version (optional)</label>
              <input value={form.baseline_version} onChange={(e) => setForm({ ...form, baseline_version: e.target.value })} />
            </div>
            <button className="btn" onClick={runEval}>Evaluate</button>
          </div>
        </div>
      </div>
    </>
  );
}
