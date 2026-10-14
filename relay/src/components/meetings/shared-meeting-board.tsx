"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareQuote } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeetingRoomControls } from "@/components/meetings/meeting-room-controls";
import { PrivacyModeToggle } from "@/components/meetings/privacy-mode-toggle";
import { generateMeetingPositions } from "@/lib/actions/meetings";
import {
  STANCE_LABEL,
  stanceTone,
  type MeetingPositions,
  type Stance,
  type StatementHighlight,
} from "@/lib/domain/meeting-positions";
import { cn } from "@/lib/utils";

type Participant = {
  id: string
  userId?: string
  name: string
  color: string
  status: string
  role: string
  response: string
};

function callLabel(response: string) {
  if (response === "in_call") return "In call";
  if (response === "ringing") return "Ringing…";
  if (response === "accepted") return "Invited";
  return response;
}

const STANCE_BORDER: Record<Stance, string> = {
  for: "border-success/45 bg-success/5",
  against: "border-danger/45 bg-danger/5",
  conditional: "border-warn/45 bg-warn/5",
  questioning: "border-accent/45 bg-accent-dim/40",
  neutral: "border-line bg-canvas/80",
};

const STANCE_BAR: Record<Stance, string> = {
  for: "bg-success",
  against: "bg-danger",
  conditional: "bg-warn",
  questioning: "bg-accent",
  neutral: "bg-faint",
};

export function SharedMeetingBoard({
  meetingId,
  status,
  topic,
  participants,
  positions,
  privacyMode = false,
}: {
  meetingId: string
  status: string
  topic: string
  participants: Participant[]
  positions: MeetingPositions | null
  privacyMode?: boolean
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // Keep the shared board populated so highlights are always visible in-room.
  useEffect(() => {
    if (!positions) {
      start(async () => {
        await generateMeetingPositions(meetingId);
        router.refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const bySpeaker = useMemo(() => {
    const map = new Map<string, StatementHighlight>();
    for (const h of positions?.highlights ?? []) {
      map.set(h.speaker, h);
      // also match first name
      map.set(h.speaker.split(" ")[0] ?? h.speaker, h);
    }
    return map;
  }, [positions]);

  const orderedHighlights = positions?.highlights ?? [];
  const stanceOrder: Stance[] = ["for", "conditional", "questioning", "against", "neutral"];
  const counts = Object.fromEntries(
    stanceOrder.map((s) => [s, orderedHighlights.filter((h) => h.stance === s).length])
  ) as Record<Stance, number>;

  return (
    <section className="overflow-hidden rounded-relay border border-line bg-surface/80 shadow-panel animate-fade-up">
      {/* Shared board header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Shared meeting board
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-ink">
            {positions?.topic ?? topic}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {privacyMode && <Badge tone="success">Private room</Badge>}
          {positions && (
            <Badge tone="accent">{positions.alignmentLabel}</Badge>
          )}
          <PrivacyModeToggle meetingId={meetingId} privacyMode={privacyMode} />
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await generateMeetingPositions(meetingId);
                router.refresh();
              })
            }
          >
            <MessageSquareQuote className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
      {privacyMode && (
        <div className="border-b border-success/25 bg-success/5 px-4 py-2 text-[11px] text-muted">
          Privacy mode is on — summaries, decisions, and highlights stay in this room and are not
          shared to Memory, stakeholders, or the broader project.
        </div>
      )}

      {/* Alignment strip — always on the shared board */}
      {positions && orderedHighlights.length > 0 && (
        <div className="border-b border-line px-4 py-2.5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {stanceOrder
              .filter((s) => counts[s] > 0)
              .map((s) => (
                <Badge key={s} tone={stanceTone(s)}>
                  {STANCE_LABEL[s]} · {counts[s]}
                </Badge>
              ))}
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3">
            {stanceOrder.map((s) => {
              const n = counts[s];
              if (!n) return null;
              return (
                <div
                  key={s}
                  className={cn(STANCE_BAR[s], "transition-all")}
                  style={{ width: `${(n / orderedHighlights.length) * 100}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        {/* Participant tiles WITH stance + position on the board */}
        <div className="p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Participants · live positions
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {participants.map((p) => {
              const highlight =
                bySpeaker.get(p.name) ?? bySpeaker.get(p.name.split(" ")[0] ?? "");
              const stance = highlight?.stance ?? "neutral";
              return (
                <article
                  key={p.id}
                  className={cn(
                    "relative overflow-hidden rounded-relay border p-3 transition-colors",
                    STANCE_BORDER[stance]
                  )}
                >
                  <div
                    className={cn("absolute inset-y-0 left-0 w-1", STANCE_BAR[stance])}
                    aria-hidden
                  />
                  <div className="flex items-start gap-3 pl-1.5">
                    <Avatar name={p.name} color={p.color} size="lg" status={p.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                        <Badge
                          tone={
                            p.response === "in_call"
                              ? "success"
                              : p.response === "ringing"
                                ? "warn"
                                : "muted"
                          }
                        >
                          {callLabel(p.response)}
                        </Badge>
                        {highlight ? (
                          <Badge tone={stanceTone(stance)}>{STANCE_LABEL[stance]}</Badge>
                        ) : (
                          <Badge tone="muted">Listening…</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-faint">{p.role}</p>
                      {highlight ? (
                        <>
                          <p className="mt-2 text-xs font-medium leading-snug text-ink">
                            {highlight.position}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-[11px] italic leading-relaxed text-muted">
                            “{highlight.highlight}”
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-[11px] text-faint">No statement pinned yet</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <MeetingRoomControls meetingId={meetingId} status={status} />
        </div>

        {/* Shared statement feed — the clear board everyone sees */}
        <aside className="border-t border-line bg-[var(--right)] lg:border-l lg:border-t-0">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Statement highlights
            </p>
            <p className="mt-0.5 text-xs text-muted">Pinned for everyone in the room</p>
          </div>
          <ol className="max-h-[520px] space-y-0 overflow-y-auto p-3">
            {orderedHighlights.length === 0 && (
              <li className="rounded-relay border border-dashed border-line px-3 py-6 text-center text-xs text-faint">
                {pending ? "Pinning statements to the shared board…" : "No highlights yet"}
              </li>
            )}
            {orderedHighlights.map((h, index) => (
              <li
                key={h.id}
                className="mb-2 rounded-relay border border-line bg-surface/90 p-3 animate-fade-up"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    name={h.speaker}
                    color={participants.find((p) => p.name === h.speaker)?.color}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-ink">{h.speaker}</span>
                      <Badge tone={stanceTone(h.stance)}>{STANCE_LABEL[h.stance]}</Badge>
                    </div>
                  </div>
                  {h.atLabel && (
                    <span className="font-mono text-[10px] text-faint">{h.atLabel}</span>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium leading-snug text-ink">{h.position}</p>
                <blockquote className="mt-2 rounded-md bg-canvas/80 px-2.5 py-2 text-[11px] italic leading-relaxed text-muted">
                  “{h.highlight}”
                </blockquote>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
