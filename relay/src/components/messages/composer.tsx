"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/actions/messages";

export function MessageComposer({
  channelSlug,
  placeholder = "Write a message…",
  summary = null,
  onSummaryChange,
  selecting = false,
  onStartSelect,
  onCancelSelect,
}: {
  channelSlug: string
  placeholder?: string
  summary?: string | null
  onSummaryChange?: (summary: string | null) => void
  selecting?: boolean
  onStartSelect?: () => void
  onCancelSelect?: () => void
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const canSend = Boolean(body.trim()) && !pending && !selecting;

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
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                AI summary
              </p>
              <button
                type="button"
                className="relay-focus rounded p-0.5 text-faint hover:text-ink"
                onClick={() => onSummaryChange?.(null)}
                aria-label="Dismiss summary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">{summary}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-line bg-canvas/70 shadow-panel backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-accent/40 focus-within:shadow-[0_0_0_1px_rgba(61,139,253,0.25),0_12px_40px_rgba(0,0,0,0.35)]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            disabled={selecting}
            placeholder={
              selecting
                ? "Select up to 30 messages above, then summarize…"
                : placeholder
            }
            className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint/80 disabled:opacity-60"
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
                disabled={selecting}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {selecting ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-faint hover:text-ink"
                  onClick={onCancelSelect}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel select
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  title="Select messages to summarize (max 30)"
                  className="rounded-lg text-faint hover:text-ink"
                  onClick={onStartSelect}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <Sparkles className="h-3.5 w-3.5" />
                  Select & summarize
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="hidden font-mono text-[10px] tracking-wide text-faint sm:inline">
                {selecting ? "max 30" : "↵ send"}
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
