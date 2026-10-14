import Link from "next/link";
import { format } from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { AttentionQueue } from "@/components/command-center/attention-queue";
import { CoordFeed } from "@/components/command-center/coord-feed";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { DemoBanner } from "@/components/ui/demo-banner";
import { getCommandCenter, getNotifications } from "@/lib/queries";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { redirect } from "next/navigation";

export default async function CommandCenterPage() {
  const seeded = await ensureSeeded();
  if (!seeded) redirect("/setup");

  const data = await getCommandCenter();
  if (!data) redirect("/setup");
  const notifications = await getNotifications();

  const feedEvents = data.runs.flatMap((r) =>
    r.events.map((e) => ({
      ...e,
      runTitle: r.title,
    }))
  );
  feedEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <AppShell
      user={data.user}
      unread={notifications.filter((n) => !n.read).length}
      contextTitle="Organizational health"
      context={
        <div className="space-y-4">
          <div className="space-y-2">
            <HealthStat label="Unresolved blockers" value={data.health.unresolvedBlockers} tone="danger" />
            <HealthStat label="Pending decisions / approvals" value={data.health.pendingDecisions} tone="warn" />
            <HealthStat label="Overdue commitments" value={data.health.overdueCommitments} tone="warn" />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Active coordination
            </p>
            <ul className="space-y-2">
              {data.runs
                .filter((r) => r.status === "active")
                .map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/coordination/${r.id}`}
                      className="block rounded-relay border border-line bg-surface-2/50 p-2.5 text-xs hover:border-line-strong"
                    >
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="mt-1 text-faint">{r.nextAction}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      }
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Home</p>
          <p className="text-sm font-medium text-ink">Command Center</p>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight text-ink">
              Good focus, {data.user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              What needs you, what&apos;s blocked, what changed, and what Relay is doing about it.
            </p>
          </div>
          <Badge tone="accent">Northline · seeded demo org</Badge>
        </div>

        <DemoBanner />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <AttentionQueue items={data.attention} />
          <div className="space-y-6">
            <CoordFeed events={feedEvents.slice(0, 8)} />
            <section className="space-y-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <h2 className="text-sm font-semibold text-ink">Upcoming meetings</h2>
              <div className="space-y-2">
                {data.meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="block rounded-relay border border-line bg-surface/80 p-3 transition-colors hover:border-line-strong hover:bg-surface-2/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink">{m.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{m.purpose}</p>
                      </div>
                      <Badge tone={m.status === "proposed" ? "accent" : "muted"}>{m.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="font-mono text-[11px] text-faint">
                        {format(m.startAt, "EEE · HH:mm")} – {format(m.endAt, "HH:mm")}
                      </p>
                      <div className="flex -space-x-1.5">
                        {m.participants.slice(0, 4).map((p) => (
                          <Avatar key={p.id} name={p.user.name} color={p.user.avatarColor} size="sm" />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-faint">Prep · {m.preparationStatus.replace("_", " ")}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function HealthStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "danger" | "warn" | "accent"
}) {
  return (
    <div className="rounded-relay border border-line bg-surface-2/40 px-3 py-2.5">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      <Badge tone={tone} className="mt-2">
        evidence-based
      </Badge>
    </div>
  );
}
