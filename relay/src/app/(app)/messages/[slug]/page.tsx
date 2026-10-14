import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageComposer } from "@/components/messages/composer";
import { ReactionBar } from "@/components/messages/reaction-bar";
import { formatRelative } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getChannelBySlug, getCurrentUser, getNotifications } from "@/lib/queries";

export default async function ChannelPage({ params }: { params: { slug: string } }) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, channel, notifications] = await Promise.all([
    getCurrentUser(),
    getChannelBySlug(params.slug),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");
  if (!channel) notFound();

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-2">
          <Link href="/messages" className="text-xs text-faint hover:text-ink">
            Messages
          </Link>
          <span className="text-faint">/</span>
          <p className="text-sm font-medium text-ink">
            {channel.type === "dm" ? channel.name : `#${channel.name}`}
          </p>
          {channel.description && (
            <span className="hidden text-xs text-muted md:inline">· {channel.description}</span>
          )}
        </div>
      }
      contextTitle="Conversation context"
      context={
        <div className="space-y-3 text-xs text-muted">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Type</p>
            <p className="mt-1 text-ink">{channel.type}</p>
          </div>
          {channel.project && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Project</p>
              <p className="mt-1 text-ink">
                {channel.project.key} · {channel.project.name}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">AI monitoring</p>
            <p className="mt-1 text-ink">{channel.isAiMonitored ? "Enabled" : "Off"}</p>
          </div>
          {channel.slug === "checkout-redesign" && (
            <Link href="/coordination/run_auth_blocker" className="block text-accent hover:underline">
              Related coordination run →
            </Link>
          )}
        </div>
      }
    >
      <div className="flex h-[calc(100vh-3rem)] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
          {channel.messages.map((m) => (
            <div key={m.id} className="group flex gap-3">
              <Avatar name={m.author.name} color={m.author.avatarColor} status={m.author.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium text-ink">{m.author.name}</span>
                  <span className="text-[11px] text-faint">{formatRelative(m.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{m.body}</p>
                <ReactionBar
                  messageId={m.id}
                  channelSlug={channel.slug}
                  reactions={m.reactions}
                  currentUserId={user.id}
                />
                {m.replies.length > 0 && (
                  <div className="mt-2 space-y-2 border-l border-line pl-3">
                    {m.replies.map((r) => (
                      <div key={r.id} className="text-xs">
                        <span className="font-medium text-ink">{r.author.name}</span>
                        <span className="ml-2 text-muted">{r.body}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-1">
          <Badge tone="muted">Mentions · @relay for AI actions in-thread</Badge>
        </div>
        <MessageComposer channelSlug={channel.slug} />
      </div>
    </AppShell>
  );
}
