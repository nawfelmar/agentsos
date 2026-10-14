"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Shield,
  ShieldOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoTile } from "@/components/calls/video-tile";
import { useLocalMedia } from "@/hooks/use-local-media";
import { useDemoPeerMedia } from "@/hooks/use-demo-peer-media";
import { endDirectCall, setDirectCallPrivacyMode } from "@/lib/actions/direct-call";
import { cn } from "@/lib/utils";

export function DirectCallRoom({
  callId,
  status,
  privacyMode,
  me,
  peer,
}: {
  callId: string
  status: string
  privacyMode: boolean
  me: { id: string; name: string; color: string }
  peer: { id: string; name: string; color: string; title: string }
}) {
  const live = status === "active" || status === "ringing";
  const media = useLocalMedia(live);
  const peerStream = useDemoPeerMedia(live, peer);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Direct call
          </p>
          <h1 className="font-display text-xl text-ink">
            {me.name.split(" ")[0]} ↔ {peer.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{peer.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={live ? "success" : "muted"}>{live ? "Connected" : status}</Badge>
          {privacyMode && <Badge tone="success">Private</Badge>}
        </div>
      </div>

      {privacyMode && (
        <div className="rounded-relay border border-success/25 bg-success/5 px-3 py-2 text-[11px] text-muted">
          Privacy mode is on — this 1:1 stays between you two and is not shared to the broader
          project.
        </div>
      )}

      {media.error && (
        <div className="rounded-relay border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          Camera/mic: {media.error}. Allow permissions and reload, or check that no other app is
          using the devices.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <VideoTile
          stream={media.stream}
          name={me.name}
          color={me.color}
          muted={media.muted}
          camOff={media.camOff}
          mirrored
          label={media.ready ? "You · live camera" : "You"}
          className="aspect-video min-h-[220px]"
        />
        <VideoTile
          stream={peerStream}
          name={peer.name}
          color={peer.color}
          label="Peer · demo stream"
          className="aspect-video min-h-[220px]"
        />
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 rounded-relay border px-3 py-3",
          privacyMode ? "border-success/30 bg-success/5" : "border-line bg-canvas/60"
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          disabled={!live}
          onClick={media.toggleMute}
          title={media.muted ? "Unmute" : "Mute"}
        >
          {media.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          disabled={!live}
          onClick={media.toggleCam}
          title={media.camOff ? "Camera on" : "Camera off"}
        >
          {media.camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="icon" disabled title="Screen share (soon)">
          <MonitorUp className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant={privacyMode ? "success" : "secondary"}
          disabled={pending || !live}
          aria-pressed={privacyMode}
          onClick={() =>
            start(async () => {
              await setDirectCallPrivacyMode(callId, !privacyMode);
              router.refresh();
            })
          }
        >
          {privacyMode ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {privacyMode ? "Privacy on" : "Privacy mode"}
        </Button>

        <Button
          variant="danger"
          size="sm"
          disabled={pending || !live}
          onClick={() =>
            start(async () => {
              media.stop();
              await endDirectCall(callId);
              router.push("/people");
              router.refresh();
            })
          }
        >
          <PhoneOff className="h-3.5 w-3.5" />
          End call
        </Button>
      </div>

      <p className="text-center text-[11px] text-faint">
        Your camera and microphone are live from this device. The other person is a demo peer stream
        in this single-browser prototype (no LiveKit room yet).
      </p>
    </div>
  );
}
