import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getChannels, getCurrentUser, getNotifications } from "@/lib/queries";

export default async function MessagesIndexPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, channels, notifications] = await Promise.all([
    getCurrentUser(),
    getChannels(),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");

  const dms = channels.filter((c) => c.type === "dm" || c.type === "group");
  const chans = channels.filter((c) => c.type === "public" || c.type === "private");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Messages</p>
          <p className="text-sm font-medium text-ink">Inbox</p>
        </div>
      }
      contextTitle="Tips"
      context={
        <p className="text-xs leading-relaxed text-muted">
          Open a channel or DM to send messages, react, and ask Relay to summarize. AI actions preview before
          consequential side effects.
        </p>
      }
    >
      <div className="mx-auto grid max-w-4xl gap-6 p-5 md:grid-cols-2 md:p-6">
        <ConversationList title="Direct & group" items={dms} />
        <ConversationList title="Channels" items={chans} />
      </div>
    </AppShell>
  );
}

function ConversationList({
  title,
  items,
}: {
  title: string
  items: Awaited<ReturnType<typeof getChannels>>
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <ul className="space-y-1">
        {items.map((c) => {
          const last = c.messages[0];
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.slug}`}
                className="flex items-start justify-between gap-3 rounded-relay border border-transparent px-3 py-2.5 hover:border-line hover:bg-surface-2/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">
                      {c.type === "public" || c.type === "private" ? `#${c.name}` : c.name}
                    </p>
                    <Badge tone="muted">{c.type}</Badge>
                  </div>
                  {last && (
                    <p className="mt-1 truncate text-xs text-muted">
                      {last.author.name}: {last.body}
                    </p>
                  )}
                </div>
                {last && (
                  <span className="shrink-0 text-[11px] text-faint">{formatRelative(last.createdAt)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
