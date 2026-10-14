import Link from "next/link";
import { redirect } from "next/navigation";
import { Hash, Lock, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
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
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
            Messages
          </p>
          <p className="text-sm font-medium text-ink">Inbox</p>
        </div>
      }
      contextTitle="Inbox"
      context={
        <p className="text-xs leading-relaxed text-muted">
          DMs and channels share one thread model. Open a conversation to write, react, or
          summarize with Relay.
        </p>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-8 p-5 md:grid-cols-2 md:p-8">
        <ConversationList
          title="Direct & group"
          items={dms}
          kind="dm"
          currentUserId={user.id}
        />
        <ConversationList title="Channels" items={chans} kind="channel" />
      </div>
    </AppShell>
  );
}

function ConversationList({
  title,
  items,
  kind,
  currentUserId,
}: {
  title: string
  items: Awaited<ReturnType<typeof getChannels>>
  kind: "dm" | "channel"
  currentUserId?: string
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-0.5">
        <h2 className="font-display text-base tracking-tight text-ink">{title}</h2>
        <span className="font-mono text-[11px] text-faint">{items.length}</span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line/80 bg-surface/40 shadow-panel">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-xs text-faint">Nothing here yet</li>
        )}
        {items.map((c, i) => {
          const last = c.messages[0];
          const peer =
            kind === "dm" && currentUserId
              ? c.members.map((m) => m.user).find((u) => u.id !== currentUserId)
              : null;
          const Icon =
            kind === "dm" ? MessagesSquare : c.type === "private" ? Lock : Hash;
          const label =
            kind === "channel" ? `#${c.name}` : peer?.name ?? c.name;
          return (
            <li key={c.id} className={i > 0 ? "border-t border-line/60" : undefined}>
              <Link
                href={`/messages/${c.slug}`}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-accent">
                  {peer ? (
                    <Avatar
                      name={peer.name}
                      color={peer.avatarColor}
                      status={peer.status}
                      size="md"
                    />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium tracking-tight text-ink">
                      {label}
                    </p>
                    {last && (
                      <span className="shrink-0 font-mono text-[10px] text-faint">
                        {formatRelative(last.createdAt)}
                      </span>
                    )}
                  </div>
                  {last ? (
                    <p className="mt-1 truncate text-[12.5px] leading-snug text-muted">
                      <span className="text-faint">{last.author.name.split(" ")[0]} · </span>
                      {last.body}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-faint">No messages yet</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
