"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime } from "../../components/ui";

export default function AgentDetailPage() {
  const params = useParams();
  const name = params.name as string;
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("AUTO-42");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const d = await api(`/agents/${name}`);
    setData(d);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
  }, [name]);

  async function deploy(version: string) {
    setBusy(true); setMsg(""); setError("");
    try {
      const res = await api(`/agents/${name}/deploy`, {
        method: "POST",
        body: JSON.stringify({ environment: "local", version, seed_demo_policies: true }),
      });
      setMsg(`Deployed ${res.version} → ${res.environment}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    setBusy(true); setMsg(""); setError("");
    try {
      const res = await api(`/agents/${name}/rollback`, {
        method: "POST",
        body: JSON.stringify({ environment: "local" }),
      });
      setMsg(`Rolled back to ${res.version}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startRun() {
    setBusy(true); setMsg(""); setError("");
    try {
      const res = await api(`/runs`, {
        method: "POST",
        body: JSON.stringify({ agent: name, environment: "local", input: { ticket } }),
      });
      setMsg(`Run created ${res.id}`);
      window.location.href = `/runs/${res.id}`;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="lede">Loading agent…</p>;

  return (
    <>
      <PageHeader
        title={name}
        lede={data?.description || "Agent detail, deployment controls, and governed run launch."}
        actions={
          <>
            <Link className="btn secondary" href="/registry">Back to registry</Link>
            <button className="btn secondary" disabled={busy} onClick={rollback}>Rollback</button>
          </>
        }
      />
      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd"><h2>Versions</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Version</th><th>Tags</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {(data?.versions || []).map((v: any) => (
                  <tr key={v.version}>
                    <td><span className="badge">{v.version}</span></td>
                    <td>{(v.tags || []).join(", ") || "—"}</td>
                    <td className="mono">{formatTime(v.created_at)}</td>
                    <td>
                      <button className="btn sm secondary" disabled={busy} onClick={() => deploy(v.version)}>
                        Deploy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><h2>Launch governed run</h2></div>
          <div className="panel-bd">
            <div className="field">
              <label>Ticket / input</label>
              <input value={ticket} onChange={(e) => setTicket(e.target.value)} />
            </div>
            <button className="btn" disabled={busy} onClick={startRun}>Start run</button>
            <p className="event-meta" style={{ marginTop: "0.85rem" }}>
              Tool calls are policy-gated. Writes may require human approval before execution.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hd"><h2>Deployments</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Environment</th><th>Version</th><th>Status</th><th>By</th><th>When</th></tr>
            </thead>
            <tbody>
              {(data?.deployments || []).map((d: any) => (
                <tr key={d.id}>
                  <td>{d.environment}</td>
                  <td><span className="badge">{d.version}</span></td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.deployed_by}</td>
                  <td className="mono">{formatTime(d.deployed_at)}</td>
                </tr>
              ))}
              {!(data?.deployments || []).length ? (
                <tr><td colSpan={5}><EmptyState title="No deployments" body="Deploy a version to an environment to activate it." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
