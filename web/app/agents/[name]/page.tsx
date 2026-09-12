"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";


export default function AgentDetailPage() {
  const params = useParams();
  const name = params.name as string;
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  function refresh() {
    api(`/agents/${name}`).then(setData).catch((e) => setMsg(String(e)));
  }

  useEffect(() => {
    refresh();
  }, [name]);

  async function deploy(version: string) {
    setMsg("");
    try {
      const res = await api(`/agents/${name}/deploy`, {
        method: "POST",
        body: JSON.stringify({ environment: "local", version, seed_demo_policies: true }),
      });
      setMsg(`Deployed ${res.version} → ${res.environment}`);
      refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function rollback() {
    try {
      const res = await api(`/agents/${name}/rollback`, {
        method: "POST",
        body: JSON.stringify({ environment: "local" }),
      });
      setMsg(`Rolled back to ${res.version}`);
      refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (!data) return <p className="sub">Loading…</p>;

  return (
    <>
      <h1>{data.name}</h1>
      <p className="sub">{data.description || "Agent detail"}</p>
      {msg && <p className="badge ok">{msg}</p>}
      <div className="panel">
        <h3>Versions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.versions?.map((v: any) => (
              <tr key={v.version}>
                <td>
                  <span className="badge">{v.version}</span>
                </td>
                <td>{(v.tags || []).join(", ") || "—"}</td>
                <td>
                  <button className="btn secondary" onClick={() => deploy(v.version)}>
                    Deploy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Deployments</h3>
        <button className="btn secondary" onClick={rollback} style={{ marginBottom: "1rem" }}>
          Rollback current
        </button>
        <table className="table">
          <thead>
            <tr>
              <th>Env</th>
              <th>Version</th>
              <th>Status</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {data.deployments?.map((d: any) => (
              <tr key={d.id}>
                <td>{d.environment}</td>
                <td>{d.version}</td>
                <td>
                  <span className={`badge ${d.status === "active" ? "ok" : ""}`}>{d.status}</span>
                </td>
                <td>{d.deployed_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
