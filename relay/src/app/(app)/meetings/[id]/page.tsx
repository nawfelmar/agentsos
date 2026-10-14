import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DemoBanner } from "@/components/ui/demo-banner";
import { MeetingRoomControls } from "@/components/meetings/meeting-room-controls";
import { parseJson } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getMeeting, getNotifications } from "@/lib/queries";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, meeting, notifications] = await Promise.all([
    getCurrentUser(),
    getMeeting(params.id),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");
  if (!meeting) notFound();

  const agenda = parseJson<{ item: string; owner: string }[]>(meeting.agendaJson, []);
  const outcomes = parseJson<{ summary?: string }>(meeting.outcomesJson, {});

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-2">
          <Link href="/meetings" className="text-xs text-faint hover:text-ink">
            Meetings
          </Link>
          <span className="text-faint">/</span>
          <p className="truncate text-sm font-medium text-ink">{meeting.title}</p>
        </div>
      }
      contextTitle="AI assistant"
      context={
        <div className="space-y-3 text-xs text-muted">
          <p>
            Relay prepared this meeting from unresolved blocker evidence. During the room, it tracks decisions
            and unanswered questions without interrupting continuously.
          </p>
          <Badge tone="accent">Demo AI participant</Badge>
          {meeting.isAiProposed && (
            <Link href="/coordination/run_auth_blocker" className="block text-accent hover:underline">
              View coordination timeline →
            </Link>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-5 p-5 md:p-6">
        <DemoBanner kinds={["av"]} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-ink">{meeting.title}</h1>
            <p className="mt-1 text-sm text-muted">{meeting.purpose}</p>
            <p className="mt-2 font-mono text-xs text-faint">
              {format(meeting.startAt, "EEE, MMM d · HH:mm")} – {format(meeting.endAt, "HH:mm")}
            </p>
          </div>
          <div className="flex gap-1.5">
            {meeting.isAiProposed && <Badge tone="accent">AI proposed</Badge>}
            <Badge tone="muted">{meeting.status}</Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-relay border border-line bg-surface/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Meeting room</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {meeting.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-2 rounded-relay border border-line bg-canvas/80 p-4"
                >
                  <Avatar name={p.user.name} color={p.user.avatarColor} size="lg" status={p.user.status} />
                  <div className="text-center">
                    <p className="text-xs font-medium text-ink">{p.user.name}</p>
                    <p className="text-[10px] text-faint">
                      {p.role} · {p.response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <MeetingRoomControls meetingId={meeting.id} status={meeting.status} />
          </section>

          <div className="space-y-4">
            <section className="rounded-relay border border-line bg-surface/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Agenda</p>
              <ol className="space-y-2">
                {agenda.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="font-mono text-faint">{i + 1}.</span>
                    <span>
                      <span className="text-ink">{a.item}</span>
                      <span className="text-faint"> · {a.owner}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-relay border border-line bg-surface/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
                Decisions & actions
              </p>
              {meeting.decisions.length === 0 && meeting.actionItems.length === 0 ? (
                <p className="text-xs text-muted">Captured after approval / meeting completion.</p>
              ) : (
                <ul className="space-y-2">
                  {meeting.decisions.map((d) => (
                    <li key={d.id} className="text-xs">
                      <Badge tone="success">decision</Badge>
                      <p className="mt-1 text-ink">{d.title}</p>
                    </li>
                  ))}
                  {meeting.actionItems.map((a) => (
                    <li key={a.id} className="text-xs">
                      <Badge tone="accent">action</Badge>
                      <p className="mt-1 text-ink">{a.title}</p>
                      <p className="text-faint">{a.owner?.name ?? "Unassigned"}</p>
                    </li>
                  ))}
                </ul>
              )}
              {outcomes.summary && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{outcomes.summary}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
