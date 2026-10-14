"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Play,
  Square,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyModeToggle } from "@/components/meetings/privacy-mode-toggle";
import { PeopleCallList } from "@/components/meetings/people-call-list";
import type { DirectoryPerson } from "@/components/meetings/call-anyone-panel";
import { cancelMeeting } from "@/lib/actions/meetings";
import { endLiveMeeting, startLiveMeeting } from "@/lib/actions/live-meeting";
import { cn } from "@/lib/utils";

export function MeetingRoomControls({
  meetingId,
  status,
  privacyMode = false,
  directory = [],
  inMeetingUserIds = [],
}: {
  meetingId: string
  status: string
  privacyMode?: boolean
  directory?: DirectoryPerson[]
  inMeetingUserIds?: string[]
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
        <div
          className={cn(
            "rounded-relay border px-3 py-2 text-center text-xs animate-pulse-soft",
            privacyMode
              ? "border-success/35 bg-success/10 text-success"
              : "border-accent/30 bg-accent-dim/40 text-accent"
          )}
        >
          {privacyMode
            ? "In call · privacy on — Call appears next to each person below"
            : "In call — Call appears next to each person; toggle privacy anytime"}
        </div>
      )}

      <div className="space-y-2 rounded-relay border border-line bg-canvas/60 px-3 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
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

          {!ended && (
            <PrivacyModeToggle meetingId={meetingId} privacyMode={privacyMode} />
          )}

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

        {/* Call next to each person — only while live (hidden otherwise) */}
        {live && !ended && directory.length > 0 && (
          <div className="border-t border-line pt-3">
            <PeopleCallList
              meetingId={meetingId}
              directory={directory}
              inMeetingUserIds={inMeetingUserIds}
              embedded
            />
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-faint">
        Demo A/V — audio/video are simulated. Per-person Call and privacy mode are real app state.
      </p>
    </div>
  );
}
