"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/lib/actions/messages";
import { cn } from "@/lib/utils";

const QUICK = [
  { emoji: "👍", label: "Acknowledge" },
  { emoji: "👀", label: "Looking" },
  { emoji: "✅", label: "Done" },
];

export function ReactionBar({
  messageId,
  channelSlug,
  reactions,
  currentUserId,
  compact = false,
}: {
  messageId: string
  channelSlug: string
  reactions: { id: string; emoji: string; userId: string }[]
  currentUserId: string
  compact?: boolean
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const grouped = QUICK.map((q) => ({
    ...q,
    count: reactions.filter((r) => r.emoji === q.emoji).length,
    mine: reactions.some((r) => r.emoji === q.emoji && r.userId === currentUserId),
  }));

  const hasAny = grouped.some((g) => g.count > 0);

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 transition-opacity duration-150",
        compact ? "mt-0.5" : "mt-1.5",
        hasAny ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      )}
    >
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          disabled={pending}
          title={g.label}
          onClick={() =>
            start(async () => {
              await toggleReaction(messageId, g.emoji, channelSlug);
              router.refresh();
            })
          }
          className={cn(
            "relay-focus inline-flex h-6 items-center gap-1 border px-1.5 text-[11px] tabular-nums transition-colors",
            compact ? "rounded-full" : "rounded-md",
            g.mine
              ? "border-accent/40 bg-accent-dim text-accent"
              : "border-line/70 bg-surface/60 text-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink"
          )}
        >
          <span className="leading-none">{g.emoji}</span>
          {g.count > 0 && <span className="text-[10px] text-faint">{g.count}</span>}
        </button>
      ))}
    </div>
  );
}
