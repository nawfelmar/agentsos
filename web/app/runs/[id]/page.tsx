"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader, StatusBadge, formatTime } from "../../components/ui";

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api(`/runs/${id}`);
        if (alive) setRun(data);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    }
    load();
    const t = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!run) return <p className="lede">Loading run timeline…</p>;

  return (
    <>
      <PageHeader
        title={`Run ${id.slice(0, 8)}`}
        lede={`${run.agent_name}@${run.version} in ${run.environment}`}
        actions={
          <>
            <StatusBadge status={run.status} />
            <Link className="btn secondary" href={`/agents/${run.agent_name}`}>Agent</Link>
            <Link className="btn secondary" href="/runs">All runs</Link>
          </>
        }
      />

      <div className="stats">
        <div className="stat-card"><div className="label">Status</div><div className="value" style={{ fontSize: "1.3rem" }}>{run.status}</div></div>
        <div className="stat-card"><div className="label">Cost</div><div className="value">€{Number(run.cost_estimate || 0).toFixed(2)}</div></div>
        <div className="stat-card"><div className="label">Tokens</div><div className="value">{run.token_usage || 0}</div></div>
        <div className="stat-card"><div className="label">Events</div><div className="value">{(run.events || []).length}</div></div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd"><h2>Timeline</h2></div>
          <div className="panel-bd">
            <ul className="timeline">
              {(run.events || []).map((e: any) => (
                <li key={e.id}>
                  <time>{formatTime(e.timestamp)}</time>
                  <div className="rail"><div className="dot" /></div>
                  <div>
                    <div className="event-title">{e.type}</div>
                    <div className="event-meta">
                      {[e.tool, e.status, e.duration_ms != null ? `${e.duration_ms}ms` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                    {e.policy_decision ? (
                      <div className="event-meta">
                        policy {e.policy_decision.effect}: {e.policy_decision.reason}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="panel">
          <div className="panel-hd"><h2>Output metadata</h2></div>
          <div className="panel-bd">
            {run.error ? <div className="error-banner">{run.error}</div> : null}
            <pre className="pre">{JSON.stringify(run.output || run.input || {}, null, 2)}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
