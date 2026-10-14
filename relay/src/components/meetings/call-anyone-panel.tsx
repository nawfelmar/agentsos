"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneCall, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { callPersonIntoMeeting } from "@/lib/actions/live-meeting";

export type DirectoryPerson = {
  id: string
  name: string
  title: string
  avatarColor: string
  status: string
};

export function CallAnyonePanel({
  meetingId,
  directory,
  inMeetingUserIds,
  meetingLive,
}: {
  meetingId: string
  directory: DirectoryPerson[]
  inMeetingUserIds: string[]
  meetingLive: boolean
}) {
  const [q, setQ] = useState("");
  const [callingId, setCallingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const available = useMemo(() => {
    const term = q.trim().toLowerCase();
    return directory
      .filter((p) => !inMeetingUserIds.includes(p.id))
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.title.toLowerCase().includes(term)
      );
  }, [directory, inMeetingUserIds, q]);

  return (
    <section className="rounded-relay border border-line bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <PhoneCall className="h-4 w-4 text-accent" />
            Call anyone
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Dial any employee into this room (demo call → they join the shared board).
          </p>
        </div>
        {!meetingLive && <Badge tone="warn">Starts meeting</Badge>}
        {meetingLive && <Badge tone="success">Live</Badge>}
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

      {flash && (
        <p className="mb-2 animate-fade-up text-xs text-success">{flash}</p>
      )}

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {available.length === 0 && (
          <li className="px-1 py-4 text-center text-xs text-faint">
            {q ? "No matches" : "Everyone is already in the meeting"}
          </li>
        )}
        {available.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-relay border border-transparent px-2 py-1.5 hover:border-line hover:bg-surface-2/50"
          >
            <Avatar name={p.name} color={p.avatarColor} status={p.status} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{p.name}</p>
              <p className="truncate text-[10px] text-faint">{p.title}</p>
            </div>
            <Button
              size="sm"
              variant={callingId === p.id ? "secondary" : "primary"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setCallingId(p.id);
                  setFlash(`Calling ${p.name}…`);
                  const res = await callPersonIntoMeeting(meetingId, p.id);
                  setFlash(`${res.name} joined the call`);
                  setCallingId(null);
                  router.refresh();
                })
              }
            >
              <Phone className="h-3 w-3" />
              {callingId === p.id ? "Ringing…" : "Call"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
