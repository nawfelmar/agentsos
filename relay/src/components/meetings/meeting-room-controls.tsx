"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelMeeting } from "@/lib/actions/meetings";

export function MeetingRoomControls({
  meetingId,
  status,
}: {
  meetingId: string
  status: string
}) {
  const [muted, setMuted] = useState(true);
  const [camOff, setCamOff] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-relay border border-dashed border-line bg-canvas/60 px-3 py-3">
        <Button variant="secondary" size="icon" onClick={() => setMuted((v) => !v)} title="Demo mute">
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icon" onClick={() => setCamOff((v) => !v)} title="Demo camera">
          {camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icon" title="Demo screen share">
          <MonitorUp className="h-4 w-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending || status === "cancelled"}
          onClick={() =>
            start(async () => {
              await cancelMeeting(meetingId);
              router.refresh();
            })
          }
        >
          <PhoneOff className="h-3.5 w-3.5" />
          Leave / cancel
        </Button>
      </div>
      <p className="text-center text-[11px] text-faint">
        Shared board is visible to everyone — stance colors and pinned statements stay in sync.
      </p>
    </div>
  );
}
