import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { MarkReadButton } from "@/components/activity/mark-read";
import { formatRelative } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getNotifications } from "@/lib/queries";

export default async function ActivityPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()]);
  if (!user) redirect("/setup");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Activity</p>
          <p className="text-sm font-medium text-ink">Notifications</p>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl space-y-2 p-5 md:p-6">
        <div className="mb-4 flex justify-end">
          <MarkReadButton />
        </div>
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`rounded-relay border p-3 ${
              n.read ? "border-line bg-surface/40" : "border-accent/30 bg-accent-dim/30"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={n.read ? "muted" : "accent"}>{n.kind}</Badge>
              {n.href ? (
                <Link href={n.href} className="text-sm font-medium text-ink hover:text-accent">
                  {n.title}
                </Link>
              ) : (
                <p className="text-sm font-medium text-ink">{n.title}</p>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">{n.body}</p>
            <p className="mt-2 text-[11px] text-faint">{formatRelative(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
