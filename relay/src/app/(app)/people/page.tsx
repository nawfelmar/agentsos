import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { CreateDummyMeetingButton } from "@/components/meetings/create-dummy-meeting-button";
import { PeopleDirectory } from "@/components/people/people-directory";
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

  const people = users.map((u) => ({
    id: u.id,
    name: u.name,
    title: u.title,
    email: u.email,
    role: u.role,
    avatarColor: u.avatarColor,
    status: u.status,
    isCurrentUser: u.isCurrentUser,
    teams: teamByUser.get(u.id) ?? [],
  }));

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
            <strong className="text-ink">Chat</strong> opens a DM.{" "}
            <strong className="text-ink">Call</strong> starts a 1:1 with camera and mic (hidden while
            you’re already in a call).
          </p>
          {activeCall ? (
            <p>
              You’re in a call with {peerName}.{" "}
              <Link href={`/calls/${activeCall.id}`} className="text-accent hover:underline">
                Return to call
              </Link>
            </p>
          ) : (
            <p>Search the directory, then Chat or Call anyone.</p>
          )}
          <CreateDummyMeetingButton className="w-full" />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-ink">Directory</h1>
            <p className="mt-1 text-sm text-muted">
              Search the org, then Chat (DM) or Call (1:1 video) next to anyone.
            </p>
            {callerBusy && (
              <p className="mt-2 text-xs text-warn">
                Call is hidden while you’re with {peerName}.{" "}
                <Link href={`/calls/${activeCall!.id}`} className="underline">
                  Open call
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {callerBusy && <Badge tone="warn">In a call</Badge>}
            <CreateDummyMeetingButton variant="secondary" />
          </div>
        </div>

        <PeopleDirectory
          people={people}
          callerBusy={callerBusy}
          activeCallHref={activeCall ? `/calls/${activeCall.id}` : null}
        />
      </div>
    </AppShell>
  );
}
