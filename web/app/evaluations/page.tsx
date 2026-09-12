"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime } from "../components/ui";

function isRegressionFail(value: unknown) {
  const s = String(value || "").toLowerCase();
  return s.includes("fail") || s.includes("worse") || s.includes("regress");
}

export default function EvaluationsPage() {
  const [evals, setEvals] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
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
    api("/agents")
      .then((list: any[]) => {
        setAgents(list);
        if (list.length) {
          const first = list[0];
          setForm((f) => ({
            ...f,
            agent: list.some((a) => a.name === f.agent) ? f.agent : first.name,
            version: first.latest_version || first.deployed_version || f.version,
          }));
        }
      })
      .catch(() => setAgents([]));
  }, []);

  const selectedAgent = agents.find((a) => a.name === form.agent);
  const versions: string[] = selectedAgent?.versions || [];

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
      setExpanded(res.id || null);
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
                  <Fragment key={e.id}>
                    <tr>
                      <td>
                        <Link href={`/agents/${encodeURIComponent(e.agent)}`}>{e.agent}</Link>
                      </td>
                      <td><span className="badge">{e.version}</span></td>
                      <td>{e.suite}</td>
                      <td>{e.score}%</td>
                      <td><StatusBadge status={e.regression} /></td>
                      <td className="mono">{formatTime(e.created_at)}</td>
                      <td style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        >
                          {expanded === e.id ? "Hide" : "Cases"}
                        </button>
                        {isRegressionFail(e.regression) ? (
                          <Link className="btn secondary sm" href={`/agents/${encodeURIComponent(e.agent)}`}>
                            Roll back
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                    {expanded === e.id ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="audit-details">
                            {(e.case_results || []).length ? (
                              (e.case_results || []).map((c: any) => (
                                <div key={c.id} className="event-meta">
                                  <StatusBadge status={c.passed ? "pass" : "fail"} />{" "}
                                  <strong>{c.id}</strong>
                                  {c.reason ? <> · {c.reason}</> : null}
                                  {c.run_id ? (
                                    <>
                                      {" "}
                                      · <Link href={`/runs/${c.run_id}`}>evidence run</Link>
                                    </>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <span className="event-meta">No case evidence recorded for this evaluation.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
              {agents.length ? (
                <select
                  value={form.agent}
                  onChange={(e) => {
                    const name = e.target.value;
                    const ag = agents.find((a) => a.name === name);
                    setForm({
                      ...form,
                      agent: name,
                      version: ag?.latest_version || ag?.deployed_version || form.version,
                    });
                  }}
                >
                  {agents.map((a) => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} />
              )}
            </div>
            <div className="field">
              <label>Version</label>
              {versions.length ? (
                <select value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}>
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              )}
            </div>
            <div className="field">
              <label>Suite</label>
              <input value={form.suite_name} onChange={(e) => setForm({ ...form, suite_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Baseline version (optional)</label>
              {versions.length ? (
                <select value={form.baseline_version} onChange={(e) => setForm({ ...form, baseline_version: e.target.value })}>
                  <option value="">None</option>
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input value={form.baseline_version} onChange={(e) => setForm({ ...form, baseline_version: e.target.value })} />
              )}
            </div>
            <button className="btn" onClick={runEval}>Evaluate</button>
          </div>
        </div>
      </div>
    </>
  );
}
