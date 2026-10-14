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
  const canSend = Boolean(body.trim()) && !pending;

  const submit = () => {
    if (!canSend) return;
    start(async () => {
      await sendMessage(channelSlug, body);
      setBody("");
      router.refresh();
    });
  };

  return (
    <div className="relative border-t border-line/60 bg-gradient-to-t from-surface via-surface/95 to-transparent px-4 pb-4 pt-3 md:px-8">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-surface/80 to-transparent" />
      <div className="relative mx-auto max-w-3xl">
        {summary && (
          <div className="mb-3 animate-fade-up rounded-relay border border-accent/20 bg-accent-dim/50 px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
              AI summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{summary}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-line bg-canvas/70 shadow-panel backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-accent/40 focus-within:shadow-[0_0_0_1px_rgba(61,139,253,0.25),0_12px_40px_rgba(0,0,0,0.35)]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint/80"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0.5">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="relay-focus rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                title="Attach (UI)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                title="Summarize conversation"
                className="rounded-lg text-faint hover:text-ink"
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
            <div className="flex items-center gap-2.5">
              <span className="hidden font-mono text-[10px] tracking-wide text-faint sm:inline">
                ↵ send
              </span>
              <Button
                size="sm"
                disabled={!canSend}
                onClick={submit}
                className="rounded-lg px-3 shadow-[0_4px_16px_-6px_rgba(61,139,253,0.7)]"
              >
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
