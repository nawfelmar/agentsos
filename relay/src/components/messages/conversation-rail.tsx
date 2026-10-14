"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatRelative } from "@/lib/utils";

export type RailConversation = {
  id: string
  slug: string
  name: string
  type: string
  createdAt: Date | string
  messages: {
    body: string
    createdAt: Date | string
    author: { id?: string; name: string; avatarColor: string }
  }[]
  members: {
    user: {
      id: string
      name: string
      avatarColor: string
      status: string
      title: string
    }
  }[]
};

export function ConversationRail({
  conversations,
  currentUserId,
  activeSlug,
}: {
  conversations: RailConversation[]
  currentUserId: string
  activeSlug?: string | null
}) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const selected =
    activeSlug ??
    (pathname.startsWith("/messages/") ? pathname.split("/")[2] ?? null : null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const peer =
        c.type === "dm"
          ? c.members.map((m) => m.user).find((u) => u.id !== currentUserId)
          : null;
      const label = c.type === "dm" ? peer?.name ?? c.name : c.name;
      const last = c.messages[0]?.body ?? "";
      return (
        label.toLowerCase().includes(needle) ||
        last.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle)
      );
    });
  }, [conversations, currentUserId, q]);

  const dms = filtered.filter((c) => c.type === "dm" || c.type === "group");
  const channels = filtered.filter((c) => c.type === "public" || c.type === "private");

  return (
    <aside className="flex h-full w-full flex-col border-r border-line/80 bg-[var(--sidebar)] md:w-[300px] lg:w-[320px]">
      <div className="shrink-0 border-b border-line/80 px-3 py-3">
        <div className="mb-2.5 flex items-baseline justify-between px-0.5">
          <h2 className="font-display text-[15px] tracking-tight text-ink">Messages</h2>
          <span className="font-mono text-[10px] text-faint">{conversations.length}</span>
        </div>
        <label className="flex items-center gap-2 rounded-relay border border-line bg-canvas/60 px-2.5 py-1.5 focus-within:border-accent/40">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people & channels"
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Direct" count={dms.length}>
          {dms.length === 0 && (
            <p className="px-3 py-4 text-center text-[11px] text-faint">No conversations yet</p>
          )}
          {dms.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              currentUserId={currentUserId}
              active={selected === c.slug}
            />
          ))}
        </Section>
        <Section title="Channels" count={channels.length}>
          {channels.length === 0 && (
            <p className="px-3 py-4 text-center text-[11px] text-faint">No channels</p>
          )}
          {channels.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              currentUserId={currentUserId}
              active={selected === c.slug}
            />
          ))}
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-1 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
          {title}
        </p>
        <span className="font-mono text-[10px] text-faint">{count}</span>
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function ConversationRow({
  conversation: c,
  currentUserId,
  active,
}: {
  conversation: RailConversation
  currentUserId: string
  active: boolean
}) {
  const isDm = c.type === "dm" || c.type === "group";
  const peer = isDm
    ? c.members.map((m) => m.user).find((u) => u.id !== currentUserId)
    : null;
  const last = c.messages[0];
  const label = isDm ? peer?.name ?? c.name : `#${c.name}`;
  const Icon = c.type === "private" ? Lock : Hash;
  const fromYou = Boolean(last?.author.id === currentUserId);

  return (
    <li>
      <Link
        href={`/messages/${c.slug}`}
        className={cn(
          "mx-1.5 flex items-start gap-2.5 rounded-relay px-2 py-2.5 transition-colors",
          active ? "bg-surface-2 text-ink" : "text-ink hover:bg-surface-2/55"
        )}
      >
        <span className="mt-0.5 shrink-0">
          {peer ? (
            <Avatar
              name={peer.name}
              color={peer.avatarColor}
              status={peer.status}
              size="md"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 text-accent">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                "truncate text-[13px] tracking-tight",
                active ? "font-semibold text-ink" : "font-medium text-ink"
              )}
            >
              {label}
            </p>
            {last && (
              <span className="shrink-0 font-mono text-[10px] text-faint">
                {formatRelative(last.createdAt)}
              </span>
            )}
          </div>
          {last ? (
            <p className="mt-0.5 truncate text-[12px] leading-snug text-muted">
              {isDm ? (
                <>
                  {fromYou && <span className="text-faint">You · </span>}
                  {last.body}
                </>
              ) : (
                <>
                  <span className="text-faint">{last.author.name.split(" ")[0]} · </span>
                  {last.body}
                </>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-faint">No messages yet</p>
          )}
        </div>
        {active && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
      </Link>
    </li>
  );
}
