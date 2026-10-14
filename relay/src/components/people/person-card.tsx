"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CallPersonButton } from "@/components/meetings/call-person-button";

export function PersonCard({
  person,
  teams,
  liveMeetingId,
  alreadyInCall,
}: {
  person: {
    id: string
    name: string
    title: string
    email: string
    role: string
    avatarColor: string
    status: string
    isCurrentUser: boolean
  }
  teams: string[]
  /** When set, Call is shown next to this person; omit when no live meeting. */
  liveMeetingId?: string | null
  alreadyInCall?: boolean
}) {
  return (
    <article className="flex items-start gap-3 rounded-relay border border-line bg-surface/70 p-3">
      <Avatar name={person.name} color={person.avatarColor} status={person.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-ink">{person.name}</p>
          {person.isCurrentUser && <Badge tone="accent">you</Badge>}
        </div>
        <p className="text-xs text-muted">{person.title}</p>
        <p className="mt-1 text-[11px] text-faint">{person.email}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge tone="muted">{person.role}</Badge>
          {teams.map((t) => (
            <Badge key={t} tone="muted">
              {t}
            </Badge>
          ))}
        </div>
      </div>
      {liveMeetingId && !person.isCurrentUser && (
        <div className="shrink-0 self-center">
          <CallPersonButton
            meetingId={liveMeetingId}
            userId={person.id}
            name={person.name}
            alreadyInCall={alreadyInCall}
          />
        </div>
      )}
    </article>
  );
}
