"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, MonitorUp, PhoneOff, Play, Square, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelMeeting } from "@/lib/actions/meetings";
import { endLiveMeeting, startLiveMeeting } from "@/lib/actions/live-meeting";

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
  const live = status === "in_progress";
  const ended = status === "completed" || status === "cancelled";

  return (
    <div className="mt-4 space-y-3">
      {!ended && !live && (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await startLiveMeeting(meetingId);
              router.refresh();
            })
          }
        >
          <Play className="h-3.5 w-3.5" />
          Start meeting
        </Button>
      )}

      {live && (
        <div className="rounded-relay border border-success/30 bg-success/10 px-3 py-2 text-center text-xs text-success animate-pulse-soft">
          Meeting live — call anyone from the directory into this room
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-relay border border-dashed border-line bg-canvas/60 px-3 py-3">
        <Button
          variant="secondary"
          size="icon"
          disabled={!live}
          onClick={() => setMuted((v) => !v)}
          title="Demo mute"
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          disabled={!live}
          onClick={() => setCamOff((v) => !v)}
          title="Demo camera"
        >
          {camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icon" disabled={!live} title="Demo screen share">
          <MonitorUp className="h-4 w-4" />
        </Button>
        {live ? (
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await endLiveMeeting(meetingId);
                router.refresh();
              })
            }
          >
            <Square className="h-3.5 w-3.5" />
            End & summarize
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            disabled={pending || ended}
            onClick={() =>
              start(async () => {
                await cancelMeeting(meetingId);
                router.refresh();
              })
            }
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
      <p className="text-center text-[11px] text-faint">
        Demo A/V — audio/video are simulated. Calling people and the shared board are real app state.
      </p>
    </div>
  );
}
