import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateDummyMeetingButton } from "@/components/meetings/create-dummy-meeting-button";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getNotifications, getUsers } from "@/lib/queries";
import { prisma } from "@/lib/db";

export default async function PeoplePage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, notifications, users] = await Promise.all([
    getCurrentUser(),
    getNotifications(),
    getUsers(),
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
          </div>
          <CreateDummyMeetingButton variant="secondary" />
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
                  <article
                    key={u.id}
                    className="flex items-start gap-3 rounded-relay border border-line bg-surface/70 p-3"
                  >
                    <Avatar name={u.name} color={u.avatarColor} status={u.status} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-ink">{u.name}</p>
                        {u.isCurrentUser && <Badge tone="accent">you</Badge>}
                      </div>
                      <p className="text-xs text-muted">{u.title}</p>
                      <p className="mt-1 text-[11px] text-faint">{u.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge tone="muted">{u.role}</Badge>
                        {(teamByUser.get(u.id) ?? []).map((t) => (
                          <Badge key={t} tone="muted">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        )}
      </div>
    </AppShell>
  );
}
