import Link from "next/link";
import { redirect } from "next/navigation";
import { Hash, Lock, MessagesSquare } from "lucide-react";
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
      contextTitle="Inbox"
      context={
        <p className="text-xs leading-relaxed text-muted">
          DMs and channels share one thread model. Open a conversation to write, react, or summarize
          with Relay.
        </p>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 p-5 md:grid-cols-2 md:p-6">
        <ConversationList title="Direct & group" items={dms} kind="dm" />
        <ConversationList title="Channels" items={chans} kind="channel" />
      </div>
    </AppShell>
  );
}

function ConversationList({
  title,
  items,
  kind,
}: {
  title: string
  items: Awaited<ReturnType<typeof getChannels>>
  kind: "dm" | "channel"
}) {
  return (
    <section className="overflow-hidden rounded-relay border border-line bg-surface/50">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-[11px] text-faint">{items.length}</span>
      </div>
      <ul className="divide-y divide-line/70">
        {items.length === 0 && (
          <li className="px-4 py-8 text-center text-xs text-faint">Nothing here yet</li>
        )}
        {items.map((c) => {
          const last = c.messages[0];
          const Icon =
            kind === "dm" ? MessagesSquare : c.type === "private" ? Lock : Hash;
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.slug}`}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-relay border border-line bg-surface-2 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {kind === "channel" ? `#${c.name}` : c.name}
                    </p>
                    {last && (
                      <span className="shrink-0 font-mono text-[10px] text-faint">
                        {formatRelative(last.createdAt)}
                      </span>
                    )}
                  </div>
                  {last ? (
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      <span className="text-faint">{last.author.name}: </span>
                      {last.body}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-faint">No messages yet</p>
                  )}
                  <div className="mt-1.5">
                    <Badge tone="muted">{c.type}</Badge>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
