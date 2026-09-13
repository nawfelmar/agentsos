"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EffectBadge, EmptyState, PageHeader } from "../components/ui";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    agent_name: "coding-agent",
    environment: "local",
    resource: "git.write",
    effect: "APPROVAL_REQUIRED",
  });
  const [msg, setMsg] = useState("");

  async function refresh() {
    setPolicies(await api("/policies"));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)));
    api("/agents")
      .then((list: any[]) => {
        setAgents(list);
        if (list.length && !list.some((a) => a.name === form.agent_name)) {
          setForm((f) => ({ ...f, agent_name: list[0].name }));
        }
      })
      .catch(() => setAgents([]));
  }, []);

  async function save() {
    setMsg("");
    setError("");
    try {
      await api("/policies", { method: "PUT", body: JSON.stringify(form) });
      setMsg(`Updated ${form.agent_name} · ${form.resource} → ${form.effect}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Policies"
        lede="Badge rules for agents — ALLOW, DENY, or APPROVAL_REQUIRED at the tool boundary — outside the LLM. Least privilege by default. Agents request; AgentOS decides."
      />
      {msg ? <div className="success-banner">{msg}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-hd"><h2>Effective rules</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Environment</th>
                  <th>Resource</th>
                  <th>Effect</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/agents/${encodeURIComponent(p.agent_name)}`}>{p.agent_name}</Link>
                    </td>
                    <td>{p.environment}</td>
                    <td><span className="badge">{p.resource}</span></td>
                    <td><EffectBadge effect={p.effect} /></td>
                  </tr>
                ))}
                {!policies.length ? (
                  <tr><td colSpan={4}><EmptyState title="No policies" body="Deploy with demo policies or create rules here." /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><h2>Upsert rule</h2></div>
          <div className="panel-bd">
            <div className="field">
              <label>Agent</label>
              {agents.length ? (
                <select value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })}>
                  {agents.map((a) => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <input value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} />
              )}
            </div>
            <div className="field">
              <label>Environment</label>
              <input value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} />
            </div>
            <div className="field">
              <label>Resource</label>
              <input value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} />
            </div>
            <div className="field">
              <label>Effect</label>
              <select value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value })}>
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
                <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED</option>
              </select>
            </div>
            <button className="btn" onClick={save}>Save policy</button>
          </div>
        </div>
      </div>
    </>
  );
}
