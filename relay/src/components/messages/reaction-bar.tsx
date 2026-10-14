"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/lib/actions/messages";

const QUICK = ["👍", "👀", "✅"];

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

  const grouped = QUICK.map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => r.emoji === emoji && r.userId === currentUserId),
  }));

  return (
    <div className="mt-1.5 flex flex-wrap gap-1 opacity-70 transition-opacity group-hover:opacity-100">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await toggleReaction(messageId, g.emoji, channelSlug);
              router.refresh();
            })
          }
          className={`relay-focus rounded-md border px-1.5 py-0.5 text-[11px] ${
            g.mine
              ? "border-accent/40 bg-accent-dim text-accent"
              : "border-line bg-surface-2 text-muted hover:border-line-strong"
          }`}
        >
          {g.emoji}
          {g.count > 0 && <span className="ml-1">{g.count}</span>}
        </button>
      ))}
    </div>
  );
}
