import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { DemoBanner } from "@/components/ui/demo-banner";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getMeetings, getNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { view?: string }
}) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, meetings, notifications] = await Promise.all([
    getCurrentUser(),
    getMeetings(),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");

  const view = searchParams.view ?? "week";
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekDays = eachDayOfInterval({
    start: startOfWeek(today),
    end: endOfWeek(today),
  });

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Calendar</p>
            <p className="text-sm font-medium text-ink">{format(today, "MMMM yyyy")}</p>
          </div>
          <div className="flex gap-1">
            <Link href="/calendar?view=week">
              <Badge tone={view === "week" ? "accent" : "muted"}>Week</Badge>
            </Link>
            <Link href="/calendar?view=month">
              <Badge tone={view === "month" ? "accent" : "muted"}>Month</Badge>
            </Link>
            <Link href="/calendar?view=day">
              <Badge tone={view === "day" ? "accent" : "muted"}>Day</Badge>
            </Link>
          </div>
        </div>
      }
      contextTitle="Conflicts"
      context={
        <p className="text-xs text-muted">
          Availability uses seeded calendars. Connect Google Calendar credentials to replace demo conflict
          checks.
        </p>
      }
    >
      <div className="space-y-4 p-5 md:p-6">
        <DemoBanner kinds={["calendar"]} />
        {view === "day" ? (
          <DayView day={today} meetings={meetings} />
        ) : view === "month" ? (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-relay border border-line bg-line">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase text-faint">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayMeetings = meetings.filter((m) => isSameDay(m.startAt, day));
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[88px] bg-surface p-1.5",
                    !isSameMonth(day, today) && "opacity-40",
                    isSameDay(day, today) && "bg-accent-dim/40"
                  )}
                >
                  <p className="text-[11px] text-muted">{format(day, "d")}</p>
                  <div className="mt-1 space-y-0.5">
                    {dayMeetings.slice(0, 2).map((m) => (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="block truncate rounded bg-surface-3 px-1 py-0.5 text-[10px] text-ink hover:bg-accent/20"
                      >
                        {format(m.startAt, "HH:mm")} {m.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-7">
            {weekDays.map((day) => {
              const dayMeetings = meetings.filter((m) => isSameDay(m.startAt, day));
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "rounded-relay border border-line bg-surface/70 p-2",
                    isSameDay(day, today) && "border-accent/40"
                  )}
                >
                  <p className="text-[11px] font-medium text-muted">{format(day, "EEE d")}</p>
                  <div className="mt-2 space-y-1">
                    {dayMeetings.length === 0 && (
                      <p className="text-[10px] text-faint">No events</p>
                    )}
                    {dayMeetings.map((m) => (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="block rounded-md border border-line bg-canvas px-1.5 py-1 text-[11px] hover:border-accent/40"
                      >
                        <p className="font-mono text-faint">{format(m.startAt, "HH:mm")}</p>
                        <p className="text-ink">{m.title}</p>
                        {m.status === "proposed" && <Badge tone="accent">proposed</Badge>}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-faint">
          Showing through {format(addDays(today, 14), "MMM d")} · demo calendar adapter
        </p>
      </div>
    </AppShell>
  );
}

function DayView({
  day,
  meetings,
}: {
  day: Date
  meetings: Awaited<ReturnType<typeof getMeetings>>
}) {
  const items = meetings.filter((m) => isSameDay(m.startAt, day));
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-ink">{format(day, "EEEE, MMMM d")}</h2>
      {items.length === 0 && <p className="text-xs text-muted">No meetings today.</p>}
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/meetings/${m.id}`}
          className="block rounded-relay border border-line bg-surface p-3 hover:border-line-strong"
        >
          <p className="font-mono text-xs text-faint">
            {format(m.startAt, "HH:mm")} – {format(m.endAt, "HH:mm")}
          </p>
          <p className="mt-1 text-sm text-ink">{m.title}</p>
        </Link>
      ))}
    </div>
  );
}
