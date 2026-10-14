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
}: {
  messageId: string
  channelSlug: string
  reactions: { id: string; emoji: string; userId: string }[]
  currentUserId: string
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
        "mt-1.5 flex flex-wrap gap-1 transition-opacity",
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
            "relay-focus inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] tabular-nums",
            g.mine
              ? "border-accent/35 bg-accent-dim text-accent"
              : "border-line/80 bg-surface/80 text-muted hover:border-line-strong hover:text-ink"
          )}
        >
          <span className="leading-none">{g.emoji}</span>
          {g.count > 0 && <span className="text-[10px] text-faint">{g.count}</span>}
        </button>
      ))}
    </div>
  );
}
