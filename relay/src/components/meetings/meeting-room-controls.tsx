"use client";

import { useTransition } from "react";
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
import { VideoTile } from "@/components/calls/video-tile";
import { useLocalMedia } from "@/hooks/use-local-media";
import { cancelMeeting } from "@/lib/actions/meetings";
import { endLiveMeeting, startLiveMeeting } from "@/lib/actions/live-meeting";
import { cn } from "@/lib/utils";

export function MeetingRoomControls({
  meetingId,
  status,
  privacyMode = false,
  selfName = "You",
  selfColor = "#5B8DEF",
}: {
  meetingId: string
  status: string
  privacyMode?: boolean
  selfName?: string
  selfColor?: string
  /** @deprecated Direct 1:1 calling lives on People — kept for API compat */
  directory?: unknown[]
  inMeetingUserIds?: string[]
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const live = status === "in_progress";
  const ended = status === "completed" || status === "cancelled";
  const media = useLocalMedia(live, { name: selfName, color: selfColor });

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
            ? "Meeting live · privacy on — your camera/mic are on this device"
            : "Meeting live — camera and mic are live; for 1:1 calls use People"}
        </div>
      )}

      {live && (
        <VideoTile
          stream={media.stream}
          name={selfName}
          color={selfColor}
          muted={media.muted}
          camOff={media.camOff}
          mirrored
          label={media.ready ? "You · live camera" : "You"}
          className="aspect-video w-full"
        />
      )}

      {media.error && live && (
        <p className="rounded-relay border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-warn">
          {media.error}
        </p>
      )}

      <div className="space-y-2 rounded-relay border border-line bg-canvas/60 px-3 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            disabled={!live}
            onClick={media.toggleMute}
            title={media.muted ? "Unmute mic" : "Mute mic"}
          >
            {media.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            disabled={!live}
            onClick={media.toggleCam}
            title={media.camOff ? "Turn camera on" : "Turn camera off"}
          >
            {media.camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="icon" disabled title="Screen share (soon)">
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
                  media.stop();
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
      </div>

      <p className="text-center text-[11px] text-faint">
        Group meetings use this room’s camera/mic. Direct 1:1 calls live on{" "}
        <a href="/people" className="text-accent hover:underline">
          People
        </a>
        .
      </p>
    </div>
  );
}
