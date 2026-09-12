"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime } from "../components/ui";

function isRegressionFail(value: unknown) {
  const s = String(value || "").toLowerCase();
  return s.includes("fail") || s.includes("worse") || s.includes("regress");
}

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
      const failed = isRegressionFail(res.regression);
      setMsg(
        failed
          ? `Score ${res.score}% · regression ${res.regression} — open the agent and roll back to the baseline.`
          : `Score ${res.score}% · regression ${res.regression}`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Evaluations"
        lede="Test & roll back — score a new version; if it’s worse, go back to the old one."
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evals.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/agents/${encodeURIComponent(e.agent)}`}>{e.agent}</Link>
                    </td>
                    <td><span className="badge">{e.version}</span></td>
                    <td>{e.suite}</td>
                    <td>{e.score}%</td>
                    <td><StatusBadge status={e.regression} /></td>
                    <td className="mono">{formatTime(e.created_at)}</td>
                    <td>
                      {isRegressionFail(e.regression) ? (
                        <Link className="btn secondary sm" href={`/agents/${encodeURIComponent(e.agent)}`}>
                          Roll back
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!evals.length ? (
                  <tr><td colSpan={7}><EmptyState title="No evaluations yet" body="Run a suite against recorded run evidence." /></td></tr>
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
