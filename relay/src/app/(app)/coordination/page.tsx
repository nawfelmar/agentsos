import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge, severityTone } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCoordinationRuns, getCurrentUser, getNotifications } from "@/lib/queries";

export default async function CoordinationPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, runs, notifications] = await Promise.all([
    getCurrentUser(),
    getCoordinationRuns(),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">AI Coordination</p>
          <p className="text-sm font-medium text-ink">Active issues</p>
        </div>
      }
      contextTitle="Human control"
      context={
        <p className="text-xs leading-relaxed text-muted">
          Approve, reject, pause, or reassign. Autonomous by design — transparent and controllable.
        </p>
      }
    >
      <div className="mx-auto max-w-5xl space-y-3 p-5 md:p-6">
        {runs.map((run) => (
          <Link
            key={run.id}
            href={`/coordination/${run.id}`}
            className="block rounded-relay border border-line bg-surface/70 p-4 transition-colors hover:border-line-strong hover:bg-surface-2/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{run.title}</p>
                <p className="mt-1 text-xs text-muted">{run.summary}</p>
              </div>
              <div className="flex gap-1.5">
                <Badge tone={severityTone(run.severity)}>{run.severity}</Badge>
                <Badge tone={run.status === "active" ? "accent" : "muted"}>{run.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-faint">
              <span>{run.blocker?.project?.key ?? "ORG"}</span>
              <span>Owner · {run.blocker?.owner?.name ?? "Relay"}</span>
              <span>Updated {formatRelative(run.updatedAt)}</span>
              <span>
                {run.proposedActions.filter((a) => a.status === "pending").length} pending approval
                {run.proposedActions.filter((a) => a.status === "pending").length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-2 text-xs text-success">Next · {run.nextAction}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
