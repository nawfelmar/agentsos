import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Hash, Lock, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageComposer } from "@/components/messages/composer";
import { MessageThread } from "@/components/messages/message-thread";
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

  const isDm = channel.type === "dm";
  const peer =
    isDm
      ? channel.members.map((m) => m.user).find((u) => u.id !== user.id) ?? null
      : null;

  const title = isDm
    ? peer?.name ?? channel.name
    : channel.type === "private"
      ? channel.name
      : channel.name;

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/messages" className="shrink-0 text-xs text-faint hover:text-ink">
            Messages
          </Link>
          <span className="text-faint">/</span>
          <p className="truncate text-sm font-medium text-ink">
            {isDm ? title : `#${title}`}
          </p>
        </div>
      }
      contextTitle={isDm ? "Direct message" : "Channel"}
      context={
        <div className="space-y-4 text-xs text-muted">
          {isDm && peer ? (
            <div className="flex items-start gap-3">
              <Avatar name={peer.name} color={peer.avatarColor} status={peer.status} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{peer.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">{peer.title}</p>
                <p className="mt-1 text-[11px] text-faint">{peer.email}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                About
              </p>
              <p className="mt-1 leading-relaxed text-ink">
                {channel.description ?? "No description"}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="muted">{channel.type}</Badge>
            {channel.isAiMonitored && <Badge tone="accent">AI monitored</Badge>}
          </div>
          {channel.project && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                Project
              </p>
              <p className="mt-1 text-ink">
                {channel.project.key} · {channel.project.name}
              </p>
            </div>
          )}
          {channel.slug === "checkout-redesign" && (
            <Link
              href="/coordination/run_auth_blocker"
              className="block text-accent hover:underline"
            >
              Related coordination run →
            </Link>
          )}
          {isDm && (
            <p className="leading-relaxed">
              Prefer a live discussion?{" "}
              <Link href="/people" className="text-accent hover:underline">
                Call from People
              </Link>
              .
            </p>
          )}
        </div>
      }
    >
      <div className="flex h-[calc(100vh-3rem)] flex-col bg-canvas/40">
        {/* Conversation chrome */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line/80 bg-surface/60 px-4 py-3 md:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-relay border border-line bg-surface-2 text-accent">
            {isDm ? (
              peer ? (
                <Avatar name={peer.name} color={peer.avatarColor} status={peer.status} />
              ) : (
                <MessagesSquare className="h-4 w-4" />
              )
            ) : channel.type === "private" ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Hash className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-base tracking-tight text-ink">
                {isDm ? title : `#${title}`}
              </h1>
              {isDm && peer && (
                <Badge tone={peer.status === "online" ? "success" : "muted"}>
                  {peer.status}
                </Badge>
              )}
            </div>
            <p className="truncate text-[12px] text-muted">
              {isDm
                ? peer?.title ?? "Direct message"
                : channel.description ?? `${channel.members.length} members`}
            </p>
          </div>
          <Badge tone="muted" className="hidden sm:inline-flex">
            {channel.messages.length} messages
          </Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageThread
            messages={channel.messages}
            currentUserId={user.id}
            channelSlug={channel.slug}
            isDm={isDm}
          />
        </div>

        <MessageComposer
          channelSlug={channel.slug}
          placeholder={
            isDm
              ? `Message ${peer?.name.split(" ")[0] ?? "them"}…`
              : `Message #${channel.name}…`
          }
        />
      </div>
    </AppShell>
  );
}
