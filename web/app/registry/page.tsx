"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader } from "../components/ui";

const SAMPLE_CONTRACT = `{
  "name": "coding-agent",
  "version": "1.0.0",
  "description": "BYO coding agent under AgentOS governance",
  "runtime": { "type": "process", "command": ["python", "examples/coding-agent/agent.py"] },
  "model": { "provider": "customer-managed", "model": "stub" },
  "capabilities": ["jira.read", "git.read", "git.write"],
  "policies": { "require_approval": ["git.write"] },
  "entrypoint": "examples/coding-agent/agent.py"
}`;

export default function RegistryPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [contractText, setContractText] = useState(SAMPLE_CONTRACT);
  const [tags, setTags] = useState("demo");

  async function refresh() {
    setAgents(await api("/agents"));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
  }, []);

  async function register() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const contract = JSON.parse(contractText);
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await api("/agents/register", {
        method: "POST",
        body: JSON.stringify({ contract, tags: tagList }),
      });
      setMsg(`Registered ${res.name}@${res.version}`);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Agent registry"
        lede="Bring your own agents — register versions like container images, then deploy under badge rules. AgentOS is not the brain."
      />
      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd">
            <h2>Fleet</h2>
            <span className="badge">{agents.length} agents</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Latest</th>
                  <th>Deployed</th>
                  <th>Environment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <strong>{a.name}</strong>
                      <div className="event-meta">{a.description || "No description"}</div>
                    </td>
                    <td><span className="badge">{a.latest_version || "—"}</span></td>
                    <td><span className="badge accent">{a.deployed_version || "—"}</span></td>
                    <td>{a.environment || "—"}</td>
                    <td><Link href={`/agents/${a.name}`}>Manage</Link></td>
                  </tr>
                ))}
                {!agents.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="Registry empty" body="Paste an agent contract on the right, or register with agentctl." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><h2>Register BYO agent</h2></div>
          <div className="panel-bd">
            <div className="field">
              <label htmlFor="contract">Agent contract (JSON)</label>
              <textarea
                id="contract"
                rows={14}
                className="mono"
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="tags">Tags (comma-separated)</label>
              <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <button className="btn" disabled={busy} onClick={register}>
              {busy ? "Registering…" : "Register version"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
