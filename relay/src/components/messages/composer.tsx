"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage, aiSummarizeChannel } from "@/lib/actions/messages";

export function MessageComposer({
  channelSlug,
  placeholder = "Write a message…",
}: {
  channelSlug: string
  placeholder?: string
}) {
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!body.trim() || pending) return;
    start(async () => {
      await sendMessage(channelSlug, body);
      setBody("");
      router.refresh();
    });
  };

  return (
    <div className="border-t border-line/80 bg-gradient-to-t from-surface via-surface/95 to-surface/80 px-4 py-3 md:px-8">
      <div className="mx-auto max-w-3xl">
        {summary && (
          <div className="mb-3 rounded-relay border border-accent/20 bg-accent-dim/40 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              AI summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{summary}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-relay border border-line bg-canvas/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus-within:border-accent/35 focus-within:ring-1 focus-within:ring-accent/20">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="max-h-36 min-h-[52px] w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t border-line/70 px-2 py-1.5">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="relay-focus rounded-md p-2 text-faint hover:bg-surface-2 hover:text-ink"
                title="Attach (UI)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                title="Summarize conversation"
                className="text-faint hover:text-ink"
                onClick={() =>
                  start(async () => {
                    const res = await aiSummarizeChannel(channelSlug);
                    setSummary(res.summary);
                  })
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                Summarize
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-faint sm:inline">
                Enter to send · Shift+Enter for newline
              </span>
              <Button size="sm" disabled={pending || !body.trim()} onClick={submit}>
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
