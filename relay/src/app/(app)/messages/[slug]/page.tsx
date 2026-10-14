import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Hash, Lock, Phone } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChannelChat } from "@/components/messages/channel-chat";
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
          <Link
            href="/messages"
            className="shrink-0 text-xs text-faint transition-colors hover:text-ink"
          >
            Messages
          </Link>
          <span className="text-faint/60">/</span>
          <p className="truncate text-sm font-medium text-ink">
            {isDm ? title : `#${title}`}
          </p>
        </div>
      }
      contextTitle={isDm ? "Direct message" : "Channel"}
      context={
        <div className="space-y-5 text-xs text-muted">
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                About
              </p>
              <p className="mt-1.5 leading-relaxed text-ink">
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                Project
              </p>
              <p className="mt-1.5 text-ink">
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
      <div className="relative flex h-[calc(100vh-3rem)] flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(720px 280px at 50% 0%, rgba(61,139,253,0.06), transparent 60%)",
          }}
        />

        <div className="relative flex shrink-0 items-center gap-3.5 border-b border-line/70 bg-surface/40 px-4 py-3.5 backdrop-blur-md md:px-8">
          {isDm && peer ? (
            <Avatar name={peer.name} color={peer.avatarColor} status={peer.status} size="lg" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-accent">
              {channel.type === "private" ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-[17px] tracking-tight text-ink">
                {isDm ? title : `#${title}`}
              </h1>
              {isDm && peer && (
                <span
                  className={
                    peer.status === "online"
                      ? "inline-flex items-center gap-1.5 text-[11px] text-success"
                      : "inline-flex items-center gap-1.5 text-[11px] text-faint"
                  }
                >
                  <span
                    className={
                      peer.status === "online"
                        ? "h-1.5 w-1.5 rounded-full bg-success"
                        : "h-1.5 w-1.5 rounded-full bg-faint"
                    }
                  />
                  {peer.status}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {isDm
                ? peer?.title ?? "Direct message"
                : channel.description ?? `${channel.members.length} members`}
            </p>
          </div>
          {isDm ? (
            <Link
              href="/people"
              className="relay-focus hidden items-center gap-1.5 rounded-relay border border-line bg-surface-2/80 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </Link>
          ) : (
            <span className="hidden font-mono text-[11px] text-faint sm:inline">
              {channel.messages.length} msgs
            </span>
          )}
        </div>

        <ChannelChat
          messages={channel.messages}
          currentUserId={user.id}
          channelSlug={channel.slug}
          isDm={isDm}
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
