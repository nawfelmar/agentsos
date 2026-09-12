"use client";

import { ReactNode } from "react";

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const raw = (status || "unknown").toLowerCase();
  let cls = "badge";
  if (["succeeded", "success", "active", "approved", "allow", "pass", "ok", "completed"].some((x) => raw.includes(x))) {
    cls += " ok";
  } else if (["pending", "waiting", "approval", "running", "warn", "high", "medium"].some((x) => raw.includes(x))) {
    cls += " warn";
  } else if (["failed", "denied", "reject", "deny", "error", "fail"].some((x) => raw.includes(x))) {
    cls += " bad";
  } else if (["info", "deploy", "low"].some((x) => raw.includes(x))) {
    cls += " info";
  }
  return <span className={cls}>{status || "—"}</span>;
}

export function EffectBadge({ effect }: { effect: string }) {
  const e = (effect || "").toUpperCase();
  const cls =
    e === "ALLOW" ? "badge ok" : e === "DENY" ? "badge bad" : e.includes("APPROVAL") ? "badge warn" : "badge";
  return <span className={cls}>{e || "—"}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body}
    </div>
  );
}

export function formatTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function shortId(id?: string) {
  if (!id) return "—";
  return id.slice(0, 8);
}
