"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/messages/composer";
import { MessageThread, type ChatMessage } from "@/components/messages/message-thread";
import { aiSummarizeSelectedMessages } from "@/lib/actions/messages";
import { MAX_SUMMARY_MESSAGES } from "@/lib/messages-constants";

export function ChannelChat({
  messages,
  currentUserId,
  channelSlug,
  isDm = false,
  placeholder,
}: {
  messages: ChatMessage[]
  currentUserId: string
  channelSlug: string
  isDm?: boolean
  placeholder?: string
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atCap = selected.length >= MAX_SUMMARY_MESSAGES;

  const toggle = (id: string) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SUMMARY_MESSAGES) {
        setError(`You can select up to ${MAX_SUMMARY_MESSAGES} messages.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelected([]);
    setError(null);
  };

  const summarizeSelected = () => {
    if (selected.length === 0 || pending) return;
    start(async () => {
      try {
        setError(null);
        const res = await aiSummarizeSelectedMessages(channelSlug, selected);
        setSummary(res.summary);
        exitSelect();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not summarize");
      }
    });
  };

  return (
    <>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <MessageThread
          messages={messages}
          currentUserId={currentUserId}
          channelSlug={channelSlug}
          isDm={isDm}
          selecting={selecting}
          selectedIds={selectedSet}
          selectionCap={MAX_SUMMARY_MESSAGES}
          onToggleSelect={toggle}
        />
      </div>

      {selecting && (
        <div className="relative z-10 border-t border-accent/25 bg-accent-dim/40 px-4 py-2.5 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <CheckSquare className="h-4 w-4 text-accent" />
            <p className="text-sm text-ink">
              <span className="font-semibold tabular-nums">{selected.length}</span>
              <span className="text-muted"> / {MAX_SUMMARY_MESSAGES} selected</span>
            </p>
            {atCap && (
              <span className="text-[11px] text-warn">Maximum reached</span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || selected.length === 0}
                onClick={() => setSelected([])}
              >
                Clear
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={exitSelect}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || selected.length === 0}
                onClick={summarizeSelected}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Summarize selected
              </Button>
            </div>
          </div>
          {error && (
            <p className="mx-auto mt-1.5 max-w-3xl text-[12px] text-danger">{error}</p>
          )}
        </div>
      )}

      <div className="relative">
        <MessageComposer
          channelSlug={channelSlug}
          placeholder={placeholder}
          summary={summary}
          onSummaryChange={setSummary}
          selecting={selecting}
          onStartSelect={() => {
            setSelecting(true);
            setError(null);
            setSummary(null);
          }}
          onCancelSelect={exitSelect}
        />
      </div>
    </>
  );
}
