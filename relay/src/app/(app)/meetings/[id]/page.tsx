import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { DemoBanner } from "@/components/ui/demo-banner";
import { MeetingSummaryCard } from "@/components/meetings/meeting-summary-card";
import { SharedMeetingBoard } from "@/components/meetings/shared-meeting-board";
import { CallAnyonePanel } from "@/components/meetings/call-anyone-panel";
import { LiveStatementForm } from "@/components/meetings/live-statement-form";
import { parseJson } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getMeeting, getNotifications, getUsers } from "@/lib/queries";
import type { MeetingSummary } from "@/lib/domain/meeting-summary";
import type { MeetingPositions } from "@/lib/domain/meeting-positions";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, meeting, notifications, directory] = await Promise.all([
    getCurrentUser(),
    getMeeting(params.id),
    getNotifications(),
    getUsers(),
  ]);
  if (!user) redirect("/setup");
  if (!meeting) notFound();

  const agenda = parseJson<{ item: string; owner: string }[]>(meeting.agendaJson, []);
  const outcomes = parseJson<{
    summary?: string
    structured?: MeetingSummary
    positions?: MeetingPositions
  }>(meeting.outcomesJson, {});

  const live = meeting.status === "in_progress";
  const inMeetingUserIds = meeting.participants.map((p) => p.userId);

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
          {live && <Badge tone="success">Live</Badge>}
        </div>
      }
      contextTitle="Run the meeting"
      context={
        <div className="space-y-3 text-xs text-muted">
          <p>
            Start the meeting, call any employee into the room, and pin statement highlights so everyone’s
            position stays clear on the shared board.
          </p>
          <Badge tone={live ? "success" : "accent"}>{live ? "In progress" : "Ready to start"}</Badge>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-5 p-5 md:p-6">
        <DemoBanner kinds={["av", "llm"]} />
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
            <Badge tone={live ? "success" : "muted"}>{meeting.status}</Badge>
          </div>
        </div>

        <SharedMeetingBoard
          meetingId={meeting.id}
          status={meeting.status}
          topic={meeting.purpose ?? meeting.title}
          positions={outcomes.positions ?? null}
          privacyMode={meeting.privacyMode}
          directory={directory.map((u) => ({
            id: u.id,
            name: u.name,
            title: u.title,
            avatarColor: u.avatarColor,
            status: u.status,
          }))}
          participants={meeting.participants.map((p) => ({
            id: p.id,
            userId: p.userId,
            name: p.user.name,
            color: p.user.avatarColor,
            status: p.user.status,
            role: p.role,
            response: p.response,
          }))}
        />

        <div className={live ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
          {!live && (
            <CallAnyonePanel
              meetingId={meeting.id}
              meetingLive={live}
              inMeetingUserIds={inMeetingUserIds}
              directory={directory.map((u) => ({
                id: u.id,
                name: u.name,
                title: u.title,
                avatarColor: u.avatarColor,
                status: u.status,
              }))}
            />
          )}
          <LiveStatementForm
            meetingId={meeting.id}
            participants={meeting.participants.map((p) => ({
              userId: p.userId,
              name: p.user.name,
            }))}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <MeetingSummaryCard
            meetingId={meeting.id}
            status={meeting.status}
            summary={outcomes.structured ?? null}
            privacyMode={meeting.privacyMode}
          />
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
                {meeting.privacyMode ? " · in-meeting only" : ""}
              </p>
              {meeting.privacyMode ? (
                outcomes.structured ? (
                  <ul className="space-y-2">
                    {outcomes.structured.decisions.map((d, i) => (
                      <li key={`pd-${i}`} className="text-xs">
                        <Badge tone="success">decision</Badge>
                        <p className="mt-1 text-ink">{d.text}</p>
                      </li>
                    ))}
                    {outcomes.structured.actionItems.map((a, i) => (
                      <li key={`pa-${i}`} className="text-xs">
                        <Badge tone="accent">action</Badge>
                        <p className="mt-1 text-ink">{a.text}</p>
                        <p className="text-faint">
                          {a.owner}
                          {a.due ? ` · ${a.due}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">
                    Privacy mode keeps outcomes in this room — generate a summary to see them here
                    without syncing to the project.
                  </p>
                )
              ) : meeting.decisions.length === 0 && meeting.actionItems.length === 0 ? (
                <p className="text-xs text-muted">Appear when you end & summarize the meeting.</p>
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
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
