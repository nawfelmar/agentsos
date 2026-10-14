"use client";

import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { ReactionBar } from "@/components/messages/reaction-bar";
import { cn } from "@/lib/utils";

type Msg = {
  id: string
  body: string
  createdAt: Date | string
  author: {
    id: string
    name: string
    avatarColor: string
    status: string
    title?: string
  }
  reactions: { id: string; emoji: string; userId: string }[]
  replies: {
    id: string
    body: string
    createdAt: Date | string
    author: { name: string; avatarColor: string }
  }[]
};

function asDate(d: Date | string) {
  return d instanceof Date ? d : new Date(d);
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d");
}

export function MessageThread({
  messages,
  currentUserId,
  channelSlug,
  isDm = false,
}: {
  messages: Msg[]
  currentUserId: string
  channelSlug: string
  isDm?: boolean
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center animate-fade-up">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2/80">
          <span className="font-display text-lg text-faint">·</span>
        </div>
        <p className="font-display text-lg tracking-tight text-ink">Start the thread</p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
          Keep it short and factual — Relay can summarize later.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 md:px-8",
        isDm ? "max-w-2xl space-y-0.5" : "max-w-3xl space-y-0.5"
      )}
    >
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const at = asDate(m.createdAt);
        const prevAt = prev ? asDate(prev.createdAt) : null;
        const showDay = !prevAt || !isSameDay(prevAt, at);
        const mine = m.author.id === currentUserId;
        const stacked =
          !!prev &&
          !!prevAt &&
          prev.author.id === m.author.id &&
          !showDay &&
          at.getTime() - prevAt.getTime() < 5 * 60_000;

        if (isDm) {
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                    {dayLabel(at)}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
                </div>
              )}
              <div
                className={cn(
                  "flex gap-2.5 animate-fade-up",
                  mine ? "flex-row-reverse" : "flex-row",
                  stacked ? "mt-1" : "mt-3.5"
                )}
              >
                <div className="w-8 shrink-0 pt-0.5">
                  {!stacked ? (
                    <Avatar
                      name={m.author.name}
                      color={m.author.avatarColor}
                      status={m.author.status}
                    />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "group max-w-[min(100%,28rem)] min-w-0",
                    mine ? "items-end" : "items-start"
                  )}
                >
                  {!stacked && (
                    <div
                      className={cn(
                        "mb-1 flex items-baseline gap-2 px-0.5",
                        mine && "flex-row-reverse"
                      )}
                    >
                      <span className="text-[12px] font-medium text-muted">
                        {mine ? "You" : m.author.name.split(" ")[0]}
                      </span>
                      <time
                        dateTime={at.toISOString()}
                        className="font-mono text-[10px] text-faint"
                      >
                        {format(at, "HH:mm")}
                      </time>
                    </div>
                  )}
                  <div
                    className={cn(
                      "relative px-3.5 py-2.5 text-[14px] leading-[1.55]",
                      mine
                        ? "rounded-[18px] rounded-tr-md bg-gradient-to-br from-[#4a94ff] to-[#2f78e8] text-white shadow-[0_10px_28px_-14px_rgba(61,139,253,0.75)]"
                        : "rounded-[18px] rounded-tl-md bg-surface-2 text-ink ring-1 ring-inset ring-white/[0.06]"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                  <div className={cn("mt-1", mine && "flex justify-end")}>
                    <ReactionBar
                      messageId={m.id}
                      channelSlug={channelSlug}
                      reactions={m.reactions}
                      currentUserId={currentUserId}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={m.id}>
            {showDay && (
              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  {dayLabel(at)}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
              </div>
            )}

            <article
              className={cn(
                "group relative -mx-2 rounded-relay px-2 py-1.5 transition-colors duration-150",
                "hover:bg-surface-2/35",
                stacked ? "mt-0" : "mt-2.5"
              )}
            >
              <div className="flex gap-3">
                <div className="w-9 shrink-0">
                  {!stacked ? (
                    <Avatar
                      name={m.author.name}
                      color={m.author.avatarColor}
                      status={m.author.status}
                    />
                  ) : (
                    <span className="block pt-1.5 text-center font-mono text-[10px] text-transparent transition-colors group-hover:text-faint">
                      {format(at, "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!stacked && (
                    <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-[13px] font-semibold tracking-tight text-ink">
                        {m.author.name}
                      </span>
                      {mine && (
                        <span className="rounded bg-accent-dim px-1 py-px text-[9px] font-semibold uppercase tracking-[0.1em] text-accent">
                          you
                        </span>
                      )}
                      <time
                        dateTime={at.toISOString()}
                        className="font-mono text-[10px] text-faint"
                      >
                        {format(at, "HH:mm")}
                      </time>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink/90">
                    {m.body}
                  </p>
                  <ReactionBar
                    messageId={m.id}
                    channelSlug={channelSlug}
                    reactions={m.reactions}
                    currentUserId={currentUserId}
                  />
                  {m.replies.length > 0 && (
                    <div className="mt-2.5 space-y-2 border-l-2 border-accent/25 pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                        {m.replies.length} {m.replies.length === 1 ? "reply" : "replies"}
                      </p>
                      {m.replies.map((r) => (
                        <div key={r.id} className="flex gap-2">
                          <Avatar name={r.author.name} color={r.author.avatarColor} size="sm" />
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-ink">{r.author.name}</p>
                            <p className="text-[12px] leading-relaxed text-muted">{r.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
