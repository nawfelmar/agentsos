import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { DemoBanner } from "@/components/ui/demo-banner";
import { CreateMeetingForm } from "@/components/meetings/create-meeting-form";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getMeetings, getNotifications, getUsers } from "@/lib/queries";

export default async function MeetingsPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, meetings, notifications, users] = await Promise.all([
    getCurrentUser(),
    getMeetings(),
    getNotifications(),
    getUsers(),
  ]);
  if (!user) redirect("/setup");

  const upcoming = meetings.filter((m) => m.status === "scheduled" || m.status === "proposed");
  const past = meetings.filter((m) => m.status === "completed" || m.status === "cancelled");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Meetings</p>
          <p className="text-sm font-medium text-ink">Schedule & rooms</p>
        </div>
      }
      contextTitle="Create meeting"
      context={<CreateMeetingForm users={users.filter((u) => !u.isCurrentUser)} />}
    >
      <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-6">
        <DemoBanner kinds={["av", "calendar"]} />
        <MeetingGroup title="Upcoming & proposed" items={upcoming} />
        <MeetingGroup title="History" items={past} />
      </div>
    </AppShell>
  );
}

function MeetingGroup({
  title,
  items,
}: {
  title: string
  items: Awaited<ReturnType<typeof getMeetings>>
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div className="space-y-2">
        {items.map((m) => (
          <Link
            key={m.id}
            href={`/meetings/${m.id}`}
            className="block rounded-relay border border-line bg-surface/70 p-3 hover:border-line-strong hover:bg-surface-2/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted">{m.purpose}</p>
              </div>
              <div className="flex gap-1.5">
                {m.isAiProposed && <Badge tone="accent">AI proposed</Badge>}
                <Badge tone={m.status === "proposed" ? "warn" : "muted"}>{m.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="font-mono text-[11px] text-faint">
                {format(m.startAt, "MMM d · HH:mm")} – {format(m.endAt, "HH:mm")}
              </p>
              <div className="flex -space-x-1.5">
                {m.participants.slice(0, 5).map((p) => (
                  <Avatar key={p.id} name={p.user.name} color={p.user.avatarColor} size="sm" />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
