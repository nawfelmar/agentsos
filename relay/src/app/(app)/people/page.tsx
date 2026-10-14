import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { CreateDummyMeetingButton } from "@/components/meetings/create-dummy-meeting-button";
import { PersonCard } from "@/components/people/person-card";
import { ensureSeeded } from "@/lib/ensure-seeded";
import {
  getActiveDirectCall,
  getCurrentUser,
  getNotifications,
  getUsers,
} from "@/lib/queries";
import { prisma } from "@/lib/db";

export default async function PeoplePage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, notifications, users, activeCall] = await Promise.all([
    getCurrentUser(),
    getNotifications(),
    getUsers(),
    getActiveDirectCall(),
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

  const callerBusy = Boolean(activeCall);
  const peerName =
    activeCall &&
    (activeCall.callerId === user.id ? activeCall.callee.name : activeCall.caller.name);

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
      contextTitle="Directory"
      context={
        <div className="space-y-3 text-xs text-muted">
          <p>
            Call next to anyone starts a direct 1:1 with camera and mic. Call is hidden while you are
            already in a call.
          </p>
          {activeCall ? (
            <p>
              You’re in a call with {peerName}.{" "}
              <Link href={`/calls/${activeCall.id}`} className="text-accent hover:underline">
                Return to call
              </Link>
            </p>
          ) : (
            <p>You’re free — Call appears next to each person.</p>
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
              Direct 1:1 calls — not group meetings. Your camera and mic turn on in the call room.
            </p>
            {callerBusy ? (
              <p className="mt-2 text-xs text-warn">
                Call buttons are hidden while you’re in a call with {peerName}.{" "}
                <Link href={`/calls/${activeCall!.id}`} className="underline">
                  Open call
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-xs text-faint">
                Pick anyone — Call sits next to their card.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {callerBusy && <Badge tone="warn">In a call</Badge>}
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
                    callerBusy={callerBusy}
                    activeCallHref={activeCall ? `/calls/${activeCall.id}` : null}
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
