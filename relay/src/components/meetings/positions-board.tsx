"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareQuote, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateMeetingPositions } from "@/lib/actions/meetings";
import {
  STANCE_LABEL,
  stanceTone,
  type MeetingPositions,
  type Stance,
} from "@/lib/domain/meeting-positions";

const STANCE_ORDER: Stance[] = ["for", "conditional", "questioning", "against", "neutral"];

export function PositionsBoard({
  meetingId,
  positions,
  participantColors,
}: {
  meetingId: string
  positions: MeetingPositions | null
  participantColors: Record<string, string>
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const counts = Object.fromEntries(
    STANCE_ORDER.map((s) => [s, positions?.highlights.filter((h) => h.stance === s).length ?? 0])
  ) as Record<Stance, number>;

  return (
    <section className="rounded-relay border border-line bg-surface/70 p-4 animate-fade-up">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-accent" />
            Who stands where
          </h2>
          <p className="mt-1 text-xs text-muted">
            Statement highlights — each person’s position in plain language, not a full transcript.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await generateMeetingPositions(meetingId);
              router.refresh();
            })
          }
        >
          <MessageSquareQuote className="h-3.5 w-3.5" />
          {positions ? "Refresh highlights" : "Capture statements"}
        </Button>
      </div>

      {!positions ? (
        <p className="text-xs text-muted">
          Capture statements to see alignment at a glance: who’s in favor, opposed, conditional, or still
          asking questions.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-relay border border-line bg-canvas/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Topic</p>
            <p className="mt-1 text-sm text-ink">{positions.topic}</p>
            <p className="mt-2 text-xs text-success">{positions.alignmentLabel}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STANCE_ORDER.filter((s) => counts[s] > 0).map((s) => (
                <Badge key={s} tone={stanceTone(s)}>
                  {STANCE_LABEL[s]} · {counts[s]}
                </Badge>
              ))}
              <Badge tone="muted">{positions.mode}</Badge>
            </div>
          </div>

          {/* Visual alignment strip */}
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
            {STANCE_ORDER.map((s) => {
              const n = counts[s];
              const total = positions.highlights.length || 1;
              if (!n) return null;
              const colors: Record<Stance, string> = {
                for: "bg-success",
                against: "bg-danger",
                conditional: "bg-warn",
                questioning: "bg-accent",
                neutral: "bg-faint",
              };
              return (
                <div
                  key={s}
                  className={`${colors[s]} transition-all`}
                  style={{ width: `${(n / total) * 100}%` }}
                  title={`${STANCE_LABEL[s]}: ${n}`}
                />
              );
            })}
          </div>

          <ul className="space-y-2.5">
            {positions.highlights.map((h) => (
              <li
                key={h.id}
                className="rounded-relay border border-line bg-canvas/60 p-3 transition-colors hover:border-line-strong"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    name={h.speaker}
                    color={participantColors[h.speaker]}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink">{h.speaker}</p>
                      <Badge tone={stanceTone(h.stance)}>{STANCE_LABEL[h.stance]}</Badge>
                      {h.atLabel && (
                        <span className="font-mono text-[10px] text-faint">{h.atLabel}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-snug text-ink">{h.position}</p>
                    <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-xs italic leading-relaxed text-muted">
                      “{h.highlight}”
                    </blockquote>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
