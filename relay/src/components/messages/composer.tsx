"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage, aiSummarizeChannel } from "@/lib/actions/messages";

export function MessageComposer({ channelSlug }: { channelSlug: string }) {
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="border-t border-line bg-surface/90 p-3">
      {summary && (
        <div className="mb-2 rounded-relay border border-accent/25 bg-accent-dim px-3 py-2 text-xs text-ink">
          <p className="font-medium text-accent">AI summary (demo)</p>
          <p className="mt-1 text-muted">{summary}</p>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-relay border border-line bg-canvas px-2 py-2 focus-within:border-accent/40">
        <button type="button" className="relay-focus rounded-md p-1.5 text-faint hover:text-ink" title="Attach (UI)">
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-faint"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!body.trim() || pending) return;
              start(async () => {
                await sendMessage(channelSlug, body);
                setBody("");
                router.refresh();
              });
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          title="Summarize with AI"
          onClick={() =>
            start(async () => {
              const res = await aiSummarizeChannel(channelSlug);
              setSummary(res.summary);
            })
          }
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              await sendMessage(channelSlug, body);
              setBody("");
              router.refresh();
            })
          }
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
