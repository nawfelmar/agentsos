"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime, shortId } from "./components/ui";
import { isProtectionAudit, protectionHeadline, protectionOutcome, protectionStory } from "./lib/protections";

export default function OverviewPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [evals, setEvals] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api("/agents"),
      api("/runs"),
      api("/approvals?status_filter=pending"),
      api("/evaluations"),
      api("/costs"),
      api("/audit?action=policy.violation").catch(() => []),
    ])
      .then(([a, r, ap, ev, c, au]) => {
        setAgents(a);
        setRuns(r);
        setApprovals(ap);
        setEvals(ev);
        setCosts(c);
        setAudit(Array.isArray(au) ? au : []);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const waiting = runs.filter((r) => r.status === "waiting_approval").length;
  const totalCost = costs.reduce((s, c) => s + Number(c.cost || 0), 0);
  const protections = audit.filter(isProtectionAudit);

  return (
    <>
      <PageHeader
        title="Overview"
        lede="Bring your agents. Limit what they can do. See every request. Enforce policy outside the model."
        actions={
          <>
            <Link className="btn secondary" href="/audit?focus=protections">See protections</Link>
            <Link className="btn" href="/approvals">Review approvals</Link>
          </>
        }
      />
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="stats">
        <div className="stat-card">
          <div className="label">Agents</div>
          <div className="value">{agents.length}</div>
          <div className="hint">Registered in organization</div>
        </div>
        <div className="stat-card">
          <div className="label">Runs</div>
          <div className="value">{runs.length}</div>
          <div className="hint">{succeeded} succeeded</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending approvals</div>
          <div className="value">{approvals.length}</div>
          <div className="hint">{waiting ? `${waiting} runs waiting` : "No blocked runs"}</div>
        </div>
        <div className="stat-card protect-stat">
          <div className="label">Protections</div>
          <div className="value">{protections.length}</div>
          <div className="hint">Rogue / denied attempts blocked</div>
        </div>
      </div>

      <div className="panel protect-panel">
        <div className="panel-hd">
          <h2>How AgentOS protected you</h2>
          <Link href="/audit?focus=protections">Full security log</Link>
        </div>
        {protections.length ? (
          <ul className="protect-list">
            {protections.slice(0, 5).map((e) => (
              <li key={e.id} className="protect-item">
                <div className="protect-item-hd">
                  <span className="protect-badge">PROTECTED</span>
                  <strong>{protectionHeadline(e)}</strong>
                  <time className="mono">{formatTime(e.timestamp)}</time>
                </div>
                <p>{protectionStory(e)}</p>
                <div className="protect-item-ft">
                  <span className="protect-outcome">{protectionOutcome()}</span>
                  {e.target_type === "run" && e.target_id ? (
                    <Link className="mono" href={`/runs/${e.target_id}`}>Open run {shortId(e.target_id)}</Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No policy violations yet"
            body="When an agent tries something outside policy — spoofing a resource, touching secrets, or writing without approval — the block shows up here with proof."
          />
        )}
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd">
            <h2>Recent runs</h2>
            <Link href="/runs">View all</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/runs/${r.id}`} className="mono">{shortId(r.id)}</Link></td>
                    <td>{r.agent_name} <span className="badge">{r.version}</span></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="mono">{formatTime(r.created_at)}</td>
                  </tr>
                ))}
                {!runs.length ? (
                  <tr><td colSpan={4}><EmptyState title="No runs yet" body="Deploy an agent and create a run to see activity." /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd">
            <h2>Attention</h2>
            <Link href="/approvals">Approvals</Link>
          </div>
          <div className="panel-bd">
            {approvals.length === 0 ? (
              <EmptyState title="Queue clear" body="No pending human approvals." />
            ) : (
              approvals.slice(0, 4).map((a) => (
                <div className="approval-card" key={a.id} style={{ boxShadow: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                    <strong>{a.resource}</strong>
                    <StatusBadge status={a.risk} />
                  </div>
                  <div className="event-meta">{a.agent_name} · {a.action}</div>
                  <div className="event-meta">{a.reason}</div>
                  <div className="split-actions">
                    <Link className="btn sm" href="/approvals">Decide</Link>
                    <Link className="btn secondary sm" href={`/runs/${a.run_id}`}>Open run</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hd">
          <h2>Latest evaluations</h2>
          <Link href="/evaluations">View all</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Version</th>
                <th>Suite</th>
                <th>Score</th>
                <th>Regression</th>
              </tr>
            </thead>
            <tbody>
              {evals.slice(0, 5).map((e) => (
                <tr key={e.id}>
                  <td>{e.agent}</td>
                  <td><span className="badge">{e.version}</span></td>
                  <td>{e.suite}</td>
                  <td>{e.score}%</td>
                  <td><StatusBadge status={e.regression} /></td>
                </tr>
              ))}
              {!evals.length ? (
                <tr><td colSpan={5}><EmptyState title="No evaluations" body="Run an evaluation after a successful agent run." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
