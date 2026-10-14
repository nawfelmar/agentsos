"use client";

import { useMemo, useState } from "react";
import { PhoneCall, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CallPersonButton } from "@/components/meetings/call-person-button";
import type { DirectoryPerson } from "@/components/meetings/call-anyone-panel";

/**
 * People with a Call button next to each person.
 * Only mount while a meeting is live — callers hide this entirely otherwise.
 */
export function PeopleCallList({
  meetingId,
  directory,
  inMeetingUserIds,
  embedded = false,
}: {
  meetingId: string
  directory: DirectoryPerson[]
  inMeetingUserIds: string[]
  embedded?: boolean
}) {
  const [q, setQ] = useState("");
  const inCall = useMemo(() => new Set(inMeetingUserIds), [inMeetingUserIds]);

  const people = useMemo(() => {
    const term = q.trim().toLowerCase();
    return directory
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.title.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const aIn = inCall.has(a.id) ? 1 : 0;
        const bIn = inCall.has(b.id) ? 1 : 0;
        if (aIn !== bIn) return aIn - bIn; // not-in-call first
        return a.name.localeCompare(b.name);
      });
  }, [directory, inCall, q]);

  return (
    <section
      className={
        embedded
          ? "rounded-relay border border-line/80 bg-surface/50 p-3"
          : "rounded-relay border border-line bg-surface/70 p-4"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <PhoneCall className="h-4 w-4 text-accent" />
            Call next to anyone
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Call sits on each person — only while this meeting is live.
          </p>
        </div>
        <Badge tone="success">Live</Badge>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-relay border border-line bg-canvas px-2.5">
        <Search className="h-3.5 w-3.5 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people…"
          className="h-8 w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
        />
      </div>

      <ul className={embedded ? "max-h-56 space-y-1 overflow-y-auto" : "max-h-72 space-y-1 overflow-y-auto"}>
        {people.length === 0 && (
          <li className="px-1 py-4 text-center text-xs text-faint">No matches</li>
        )}
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-relay border border-transparent px-2 py-1.5 hover:border-line hover:bg-surface-2/50"
          >
            <Avatar name={p.name} color={p.avatarColor} status={p.status} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{p.name}</p>
              <p className="truncate text-[10px] text-faint">{p.title}</p>
            </div>
            <CallPersonButton
              meetingId={meetingId}
              userId={p.id}
              name={p.name}
              alreadyInCall={inCall.has(p.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
