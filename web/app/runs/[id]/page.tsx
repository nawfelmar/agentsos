"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function RunTimelinePage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<any>(null);

  useEffect(() => {
    api(`/runs/${id}`).then(setRun).catch(console.error);
    const t = setInterval(() => api(`/runs/${id}`).then(setRun).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [id]);

  if (!run) return <p className="sub">Loading…</p>;

  return (
    <>
      <h1>Run timeline</h1>
      <p className="sub">
        {run.agent_name}@{run.version} · <span className="badge">{run.status}</span>
      </p>
      <div className="panel">
        <ul className="timeline">
          {run.events?.map((e: any) => (
            <li key={e.id}>
              <time>{e.timestamp}</time>
              <div>
                <strong>{e.type}</strong>
                {e.tool ? ` · ${e.tool}` : ""}
                {e.status ? ` · ${e.status}` : ""}
                {e.policy_decision ? (
                  <div className="sub">
                    policy: {e.policy_decision.effect} — {e.policy_decision.reason}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {run.output && (
        <div className="panel">
          <h3>Output (metadata)</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
            {JSON.stringify(run.output, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
