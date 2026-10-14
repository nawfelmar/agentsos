import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { CreateDummyMeetingButton } from "@/components/meetings/create-dummy-meeting-button";
import { PersonCard } from "@/components/people/person-card";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getLiveMeeting, getNotifications, getUsers } from "@/lib/queries";
import { prisma } from "@/lib/db";

export default async function PeoplePage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, notifications, users, liveMeeting] = await Promise.all([
    getCurrentUser(),
    getNotifications(),
    getUsers(),
    getLiveMeeting(),
  ]);
  if (!user) redirect("/setup");

  const memberships = await prisma.teamMembership.findMany({
    include: { team: true },
  });
  const teamByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const list = teamByUser.get(m.userId) ?? [];
    list.push(m.team.name);
    teamByUser.set(m.userId, list);
  }

  const inCallIds = new Set(liveMeeting?.participants.map((p) => p.userId) ?? []);

  const byRole = {
    executive: users.filter((u) => u.role === "executive"),
    tech_lead: users.filter((u) => u.role === "tech_lead"),
    engineer: users.filter((u) => u.role === "engineer"),
    product: users.filter((u) => u.role === "product"),
    other: users.filter(
      (u) => !["executive", "tech_lead", "engineer", "product"].includes(u.role)
    ),
  };

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">People</p>
          <p className="text-sm font-medium text-ink">Dummy employees · {users.length}</p>
        </div>
      }
      contextTitle="Demo data"
      context={
        <div className="space-y-3 text-xs text-muted">
          <p>
            Northline is seeded with a full engineering org. Create a dummy meeting to put several of
            them on a shared board with statement highlights.
          </p>
          {liveMeeting ? (
            <p>
              A meeting is live —{" "}
              <Link href={`/meetings/${liveMeeting.id}`} className="text-accent hover:underline">
                {liveMeeting.title}
              </Link>
              . Call appears next to each person.
            </p>
          ) : (
            <p>Call next to each person is hidden until a meeting is live.</p>
          )}
          <CreateDummyMeetingButton className="w-full" />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-ink">Directory</h1>
            <p className="mt-1 text-sm text-muted">
              Seeded employees across Platform, Checkout, and Data.
            </p>
            {liveMeeting ? (
              <p className="mt-2 text-xs text-success">
                Live: <Link href={`/meetings/${liveMeeting.id}`} className="underline">{liveMeeting.title}</Link>
                {" — "}Call is next to each person
              </p>
            ) : (
              <p className="mt-2 text-xs text-faint">
                Start a meeting to reveal Call next to anyone in this directory.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {liveMeeting && <Badge tone="success">Meeting live</Badge>}
            <CreateDummyMeetingButton variant="secondary" />
          </div>
        </div>

        {(
          [
            ["Executives", byRole.executive],
            ["Tech leads", byRole.tech_lead],
            ["Engineers", byRole.engineer],
            ["Product & design", byRole.product],
            ["Other", byRole.other],
          ] as const
        ).map(([label, list]) =>
          list.length === 0 ? null : (
            <section key={label} className="space-y-2">
              <h2 className="text-sm font-semibold text-ink">
                {label}{" "}
                <span className="text-faint font-normal">· {list.length}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u) => (
                  <PersonCard
                    key={u.id}
                    person={u}
                    teams={teamByUser.get(u.id) ?? []}
                    liveMeetingId={liveMeeting?.id}
                    alreadyInCall={inCallIds.has(u.id)}
                  />
                ))}
              </div>
            </section>
          )
        )}
      </div>
    </AppShell>
  );
}
