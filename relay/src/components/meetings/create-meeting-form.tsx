"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createMeeting } from "@/lib/actions/meetings";

const inputClass =
  "w-full rounded-relay border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent/40";

export function CreateMeetingForm({
  users,
}: {
  users: { id: string; name: string }[]
}) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createMeeting({
            title,
            purpose,
            startAt: new Date(startAt).toISOString(),
            durationMinutes: duration,
            participantIds: selected,
          });
          router.push(`/meetings/${res.id}`);
          router.refresh();
        });
      }}
    >
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Working session"
        />
      </Field>
      <Field label="Purpose">
        <textarea
          required
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className={`${inputClass} min-h-[64px]`}
          placeholder="Why this meeting exists"
        />
      </Field>
      <Field label="Start">
        <input
          required
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Duration (min)">
        <input
          type="number"
          min={10}
          max={90}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className={inputClass}
        />
      </Field>
      <Field label="Participants">
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-relay border border-line p-2">
          {users.map((u) => {
            const on = selected.includes(u.id);
            return (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setSelected((prev) => (on ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                  }
                />
                {u.name}
              </label>
            );
          })}
        </div>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        Create meeting
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-faint">{label}</span>
      {children}
    </label>
  );
}
