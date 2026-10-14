import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { Badge, severityTone } from "@/components/ui/badge";
import { RunActions } from "@/components/coordination/run-actions";
import {
  ConfirmPendingPromptAction,
  PromptComposer,
} from "@/components/coordination/prompt-composer";
import { formatRelative, parseJson } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import {
  getCoordinationPrompts,
  getCoordinationRun,
  getCoordinationRuns,
  getCurrentUser,
  getNotifications,
} from "@/lib/queries";

export default async function CoordinationRunPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { approved?: string }
}) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, run, notifications, savedPrompts, allRuns] = await Promise.all([
    getCurrentUser(),
    getCoordinationRun(params.id),
    getNotifications(),
    getCoordinationPrompts(),
    getCoordinationRuns(),
  ]);
  if (!user) redirect("/setup");
  if (!run) notFound();

  const pending = run.proposedActions.find((a) => a.status === "pending");
  const evidence = run.evidence as { type: string; label: string; detail: string; href?: string }[];

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-2">
          <Link href="/coordination" className="text-xs text-faint hover:text-ink">
            Coordination
          </Link>
          <span className="text-faint">/</span>
          <p className="truncate text-sm font-medium text-ink">{run.title}</p>
        </div>
      }
      contextTitle="Next action"
      context={
        <div className="space-y-3 text-xs">
          <p className="text-muted">{run.nextAction}</p>
          <RunActions
            runId={run.id}
            status={run.status}
            proposedActionId={pending?.id}
            blockerId={run.blockerId}
          />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-6">
        {searchParams.approved === "1" && (
          <div className="animate-fade-up rounded-relay border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Meeting approved. Decision, action item, and stakeholder update are now in Memory and Meetings.
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-ink">{run.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{run.summary}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge tone={severityTone(run.severity)}>{run.severity}</Badge>
            <Badge tone="muted">{run.status}</Badge>
          </div>
        </div>

        <RunActions
          runId={run.id}
          status={run.status}
          proposedActionId={pending?.id}
          blockerId={run.blockerId}
        />

        <PromptComposer
          runs={allRuns.map((r) => ({ id: r.id, title: r.title, status: r.status }))}
          savedPrompts={savedPrompts}
          defaultRunId={run.id}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Evidence</h2>
            <ul className="space-y-2">
              {evidence.map((e, i) => (
                <li key={i} className="rounded-relay border border-line bg-surface/70 p-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="muted">{e.type}</Badge>
                    {e.href ? (
                      <Link href={e.href} className="text-sm font-medium text-accent hover:underline">
                        {e.label}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-ink">{e.label}</p>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{e.detail}</p>
                </li>
              ))}
            </ul>

            {run.blocker && (
              <div className="rounded-relay border border-line bg-surface/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Blocker</p>
                <p className="mt-1 text-sm text-ink">{run.blocker.title}</p>
                <p className="mt-1 text-xs text-muted">{run.blocker.description}</p>
                <p className="mt-2 text-[11px] text-faint">
                  Owner · {run.blocker.owner?.name} · status {run.blocker.status}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">AI activity timeline</h2>
            <ol className="space-y-0">
              {run.events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-4">
                  {i < run.events.length - 1 && (
                    <span className="absolute left-[7px] top-5 bottom-0 w-px bg-line" />
                  )}
                  <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <p className="text-sm text-ink">{e.title}</p>
                    {e.detail && <p className="mt-1 text-xs text-muted">{e.detail}</p>}
                    {e.outcome && <p className="mt-1 text-[11px] text-success">→ {e.outcome}</p>}
                    <p className="mt-1 text-[11px] text-faint">
                      {e.actor} · {formatRelative(e.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Proposed actions</h2>
          {run.proposedActions.map((a) => {
            const payload = parseJson<{ meetingId?: string }>(a.payloadJson, {});
            return (
              <div key={a.id} className="rounded-relay border border-line bg-surface/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <Badge tone={a.status === "pending" ? "warn" : a.status === "approved" ? "success" : "muted"}>
                    {a.status}
                  </Badge>
                  <Badge tone="muted">{a.kind}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{a.description}</p>
                {payload.meetingId && (
                  <Link
                    href={`/meetings/${payload.meetingId}`}
                    className="mt-2 inline-block text-xs text-accent hover:underline"
                  >
                    Open proposed meeting →
                  </Link>
                )}
                {a.status === "pending" && (
                  <div className="mt-3">
                    <ConfirmPendingPromptAction proposedActionId={a.id} title={a.title} />
                  </div>
                )}
                {a.approvals.map((ap) => (
                  <p key={ap.id} className="mt-2 text-[11px] text-faint">
                    {ap.user.name} {ap.decision} · {format(ap.createdAt, "MMM d HH:mm")}
                    {ap.note ? ` — ${ap.note}` : ""}
                  </p>
                ))}
              </div>
            );
          })}
        </section>

        {run.meeting && (
          <section className="rounded-relay border border-line bg-surface/70 p-4">
            <h2 className="text-sm font-semibold text-ink">Linked meeting</h2>
            <Link href={`/meetings/${run.meeting.id}`} className="mt-1 block text-sm text-accent hover:underline">
              {run.meeting.title}
            </Link>
            <p className="mt-1 font-mono text-xs text-faint">
              {format(run.meeting.startAt, "MMM d HH:mm")} · {run.meeting.status}
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Stakeholder updates</h2>
          {run.updates.map((u) => {
            const facts = parseJson<{ claim: string; kind: string }[]>(u.factsJson, []);
            return (
              <article key={u.id} className="rounded-relay border border-line bg-surface/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{u.title}</p>
                  <Badge tone={u.status === "sent" ? "success" : "warn"}>{u.status}</Badge>
                  <Badge tone="muted">{u.audience}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{u.body}</p>
                <ul className="mt-3 space-y-1">
                  {facts.map((f, i) => (
                    <li key={i} className="flex gap-2 text-[11px]">
                      <Badge tone={f.kind === "fact" ? "accent" : "muted"}>{f.kind}</Badge>
                      <span className="text-muted">{f.claim}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
