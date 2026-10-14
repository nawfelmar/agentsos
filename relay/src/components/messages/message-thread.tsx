"use client";

import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { ReactionBar } from "@/components/messages/reaction-bar";
import { cn } from "@/lib/utils";

type Msg = {
  id: string
  body: string
  createdAt: Date
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
    createdAt: Date
    author: { name: string; avatarColor: string }
  }[]
};

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
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
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-lg text-ink">No messages yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Start the conversation — keep it factual and short.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1 px-4 py-5 md:px-8">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
        const mine = m.author.id === currentUserId;
        const stacked =
          !!prev &&
          prev.author.id === m.author.id &&
          !showDay &&
          m.createdAt.getTime() - prev.createdAt.getTime() < 5 * 60_000;

        return (
          <div key={m.id}>
            {showDay && (
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-x-0 h-px bg-line" />
                <span className="relative rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium tracking-wide text-faint">
                  {dayLabel(m.createdAt)}
                </span>
              </div>
            )}

            <article
              className={cn(
                "group relative rounded-relay px-2 py-1.5 transition-colors hover:bg-surface-2/40",
                stacked ? "mt-0.5" : "mt-3",
                isDm && mine && "bg-accent-dim/20 hover:bg-accent-dim/30"
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
                    <span className="block pt-1 text-center font-mono text-[10px] text-transparent group-hover:text-faint">
                      {format(m.createdAt, "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!stacked && (
                    <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold tracking-tight text-ink">
                        {m.author.name}
                      </span>
                      {mine && (
                        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-accent">
                          you
                        </span>
                      )}
                      <time
                        dateTime={m.createdAt.toISOString()}
                        className="font-mono text-[11px] text-faint"
                      >
                        {format(m.createdAt, "HH:mm")}
                      </time>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-ink/92">
                    {m.body}
                  </p>
                  <ReactionBar
                    messageId={m.id}
                    channelSlug={channelSlug}
                    reactions={m.reactions}
                    currentUserId={currentUserId}
                  />
                  {m.replies.length > 0 && (
                    <div className="mt-2 space-y-2 rounded-relay border border-line/80 bg-canvas/40 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
                        Thread · {m.replies.length}
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
