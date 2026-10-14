"use client";

import { MessageSquareQuote, Shield } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type CallHighlight = {
  id: string
  speaker: string
  color: string
  text: string
  atLabel?: string
};

/** Statement / highlights board for the call right rail. */
export function CallSideBoard({
  peerName,
  peerTitle,
  peerColor,
  privacyMode,
  highlights,
}: {
  peerName: string
  peerTitle: string
  peerColor: string
  privacyMode: boolean
  highlights: CallHighlight[]
}) {
  return (
    <div className="flex h-full flex-col gap-4 text-xs text-muted">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          On this call
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <Avatar name={peerName} color={peerColor} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{peerName}</p>
            <p className="truncate text-[11px] text-faint">{peerTitle}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="success">1:1 live</Badge>
          {privacyMode ? (
            <Badge tone="success">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3 w-3" /> Private
              </span>
            </Badge>
          ) : (
            <Badge tone="muted">Standard</Badge>
          )}
        </div>
      </div>

      {privacyMode && (
        <p className="rounded-relay border border-success/25 bg-success/5 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
          Privacy on — this call stays between you two and is not shared to Memory or the broader
          project.
        </p>
      )}

      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-accent" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Statement highlights
          </p>
        </div>
        <p className="mb-2 text-[11px] text-faint">Pinned for this room</p>
        <ol className="space-y-2">
          {highlights.length === 0 && (
            <li className="rounded-relay border border-dashed border-line px-3 py-5 text-center text-[11px] text-faint">
              Highlights appear as the conversation progresses
            </li>
          )}
          {highlights.map((h) => (
            <li
              key={h.id}
              className="rounded-relay border border-line bg-surface/80 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Avatar name={h.speaker} color={h.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink">
                  {h.speaker}
                </span>
                {h.atLabel && (
                  <span className="font-mono text-[10px] text-faint">{h.atLabel}</span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] italic leading-relaxed text-muted">“{h.text}”</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
