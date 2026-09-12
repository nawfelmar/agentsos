"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, PageHeader, StatusBadge, formatTime, shortId } from "../components/ui";

const STATUSES = ["all", "pending", "running", "waiting_approval", "succeeded", "failed", "stopped"];

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [agent, setAgent] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("agent");
    if (a) setAgent(a);
  }, []);

  async function refresh(nextAgent = agent, nextStatus = status) {
    const qs = new URLSearchParams();
    if (nextAgent !== "all") qs.set("agent", nextAgent);
    if (nextStatus !== "all") qs.set("status", nextStatus);
    const path = qs.toString() ? `/runs?${qs}` : "/runs";
    setRuns(await api(path));
  }

  useEffect(() => {
    api("/agents")
      .then((list: any[]) => setAgents(list.map((a) => a.name).sort()))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        if (!cancelled) await refresh();
      } catch (e: any) {
        if (!cancelled) setError(String(e.message || e));
      }
    }
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [agent, status]);

  const emptyHint = useMemo(() => {
    if (agent !== "all" || status !== "all") return "No runs match these filters.";
    return "Start a governed run from an agent detail page.";
  }, [agent, status]);

  return (
    <>
      <PageHeader
        title="Runs"
        lede="Every run opens the control room live view — CCTV timeline of tool calls, badge checks, approvals, and cost. Not a chat log."
        actions={
          <div className="toolbar">
            <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Filter by agent">
              <option value="all">All agents</option>
              {agents.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
              ))}
            </select>
          </div>
        }
      />
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Agent</th>
                <th>Env</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><Link className="mono" href={`/runs/${r.id}`}>{shortId(r.id)}</Link></td>
                  <td>
                    <Link href={`/agents/${encodeURIComponent(r.agent_name)}`}>{r.agent_name}</Link>{" "}
                    <span className="badge">{r.version}</span>
                  </td>
                  <td>{r.environment}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>€{Number(r.cost_estimate || 0).toFixed(2)}</td>
                  <td className="mono">{formatTime(r.created_at)}</td>
                </tr>
              ))}
              {!runs.length ? (
                <tr><td colSpan={6}><EmptyState title="No runs" body={emptyHint} /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
