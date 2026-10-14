"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { pinLiveStatement } from "@/lib/actions/live-meeting";
import { STANCE_LABEL, type Stance } from "@/lib/domain/meeting-positions";

const STANCES: Stance[] = ["for", "against", "conditional", "questioning", "neutral"];

export function LiveStatementForm({
  meetingId,
  participants,
}: {
  meetingId: string
  participants: { userId: string; name: string }[]
}) {
  const [speakerUserId, setSpeakerUserId] = useState(participants[0]?.userId ?? "");
  const [stance, setStance] = useState<Stance>("conditional");
  const [position, setPosition] = useState("");
  const [highlight, setHighlight] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (participants.length === 0) return null;

  return (
    <section className="rounded-relay border border-line bg-surface/70 p-4">
      <h2 className="text-sm font-semibold text-ink">Pin a live statement</h2>
      <p className="mt-0.5 text-[11px] text-muted">
        Reflect what someone just said onto the shared board for everyone.
      </p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await pinLiveStatement({
              meetingId,
              speakerUserId,
              stance,
              position,
              highlight: highlight || position,
            });
            setPosition("");
            setHighlight("");
            router.refresh();
          });
        }}
      >
        <label className="block space-y-1">
          <span className="text-[11px] text-faint">Speaker</span>
          <select
            value={speakerUserId}
            onChange={(e) => setSpeakerUserId(e.target.value)}
            className="w-full rounded-relay border border-line bg-canvas px-2 py-1.5 text-xs text-ink"
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-faint">Stance</span>
          <select
            value={stance}
            onChange={(e) => setStance(e.target.value as Stance)}
            className="w-full rounded-relay border border-line bg-canvas px-2 py-1.5 text-xs text-ink"
          >
            {STANCES.map((s) => (
              <option key={s} value={s}>
                {STANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-faint">Position (plain language)</span>
          <input
            required
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. OK to slip RC if publish misses 10am"
            className="w-full rounded-relay border border-line bg-canvas px-2 py-1.5 text-xs text-ink outline-none focus:border-accent/40"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-faint">Quote / highlight</span>
          <input
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            placeholder="Optional exact words"
            className="w-full rounded-relay border border-line bg-canvas px-2 py-1.5 text-xs text-ink outline-none focus:border-accent/40"
          />
        </label>
        <Button type="submit" disabled={pending || !position.trim()} className="w-full">
          Pin to shared board
        </Button>
      </form>
    </section>
  );
}
