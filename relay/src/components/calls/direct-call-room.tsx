"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Minimize2,
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
import { DraggablePip } from "@/components/calls/draggable-pip";
import { useLocalMedia } from "@/hooks/use-local-media";
import { useDemoPeerMedia } from "@/hooks/use-demo-peer-media";
import {
  answerDirectCall,
  endDirectCall,
  setDirectCallPrivacyMode,
} from "@/lib/actions/direct-call";
import {
  armCallAudio,
  playRelayConnected,
  playRelayHangup,
  startRelayRing,
  stopRelayRing,
} from "@/lib/call-sounds";
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
  const ringing = status === "ringing";
  const live = status === "active" || ringing;
  const media = useLocalMedia(live, { name: me.name, color: me.color });
  const peerStream = useDemoPeerMedia(status === "active", peer);
  const [pending, start] = useTransition();
  const router = useRouter();
  const answeredRef = useRef(false);

  // Ring while status is ringing; auto-answer after ~1.8s with connected chirp
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    (async () => {
      await armCallAudio();
      if (cancelled) return;
      if (ringing) {
        void startRelayRing();
        timer = setTimeout(() => {
          if (cancelled || answeredRef.current) return;
          answeredRef.current = true;
          start(async () => {
            stopRelayRing();
            await answerDirectCall(callId);
            await playRelayConnected();
            router.refresh();
          });
        }, 2400);
      } else {
        stopRelayRing();
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopRelayRing();
    };
  }, [ringing, callId, router, start]);

  return (
    <div id="call-stage" className="relative h-full w-full overflow-hidden bg-[#07090c]">
      <VideoTile
        stream={status === "active" ? peerStream : null}
        name={peer.name}
        color={peer.color}
        playAudio={status === "active"}
        label={ringing ? "Ringing…" : "Remote · stock A/V"}
        className="absolute inset-0 h-full w-full rounded-none border-0"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 via-black/20 to-transparent px-5 pb-16 pt-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Badge tone={ringing ? "warn" : "success"}>
            {ringing ? "Ringing" : "Connected"}
          </Badge>
          {privacyMode && <Badge tone="success">Private</Badge>}
          <p className="text-sm font-medium text-white drop-shadow">{peer.name}</p>
          <p className="text-xs text-white/65">{peer.title}</p>
        </div>
        {ringing && (
          <p className="mt-2 text-[11px] text-white/70">
            Connecting — soft Relay tone…
          </p>
        )}
        {media.error && (
          <p className="pointer-events-auto mt-2 max-w-lg rounded-md bg-black/50 px-2.5 py-1.5 text-[11px] text-warn">
            {media.error}
          </p>
        )}
      </div>

      <DraggablePip width={208} height={132}>
        <VideoTile
          stream={media.stream}
          name={me.name}
          color={me.color}
          muted={media.muted}
          camOff={media.camOff}
          mirrored={!media.usingFallback}
          label="You"
          className="h-full w-full rounded-relay border border-white/20"
        />
      </DraggablePip>

      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-5 pt-12">
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-2 rounded-relay border px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md",
            privacyMode
              ? "border-success/35 bg-[#0c1410]/90"
              : "border-white/10 bg-[#12161c]/90"
          )}
        >
          <Button
            variant="secondary"
            size="icon"
            disabled={!live || ringing}
            onClick={media.toggleMute}
            title={media.muted ? "Unmute" : "Mute"}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {media.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            disabled={!live || ringing}
            onClick={media.toggleCam}
            title={media.camOff ? "Camera on" : "Camera off"}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {media.camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            disabled
            title="Screen share (soon)"
            className="border-white/10 bg-white/5 text-white/50"
          >
            <MonitorUp className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant={privacyMode ? "success" : "secondary"}
            disabled={pending || !live || ringing}
            aria-pressed={privacyMode}
            className={
              privacyMode
                ? undefined
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            }
            onClick={() =>
              start(async () => {
                await setDirectCallPrivacyMode(callId, !privacyMode);
                router.refresh();
              })
            }
          >
            {privacyMode ? (
              <Shield className="h-3.5 w-3.5" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5" />
            )}
            {privacyMode ? "Privacy on" : "Privacy mode"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !live || ringing}
            title="Minimize call — keep listening while you browse"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => {
              // Leave the immersive room; AppShell ongoing chrome keeps A/V audible.
              router.push("/people");
              router.refresh();
            }}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Minimize
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={pending || !live}
            onClick={() =>
              start(async () => {
                stopRelayRing();
                await playRelayHangup();
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
      </div>
    </div>
  );
}
