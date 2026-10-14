"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Maximize2, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_PEER_MEDIA } from "@/lib/media/demo-media";
import {
  endDirectCall,
  getActiveDirectCallSummary,
  type ActiveDirectCallSummary,
} from "@/lib/actions/direct-call";
import { armCallAudio, playRelayHangup, stopRelayRing } from "@/lib/call-sounds";
import { cn } from "@/lib/utils";

const linkBtn =
  "relay-focus inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-relay text-sm font-medium transition-colors border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-line-strong";
const linkBtnSm = `${linkBtn} h-7 px-2.5 text-xs`;
const linkBtnIcon = `${linkBtn} h-8 w-8`;

function elapsedLabel(iso: string) {
  const start = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Persistent bar + floating mini with live peer audio while browsing. */
export function OngoingCallBar({
  initial = null,
  hideOnCallPage = true,
}: {
  initial?: ActiveDirectCallSummary | null
  hideOnCallPage?: boolean
}) {
  const [call, setCall] = useState<ActiveDirectCallSummary | null>(initial);
  const [tick, setTick] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [pending, start] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const onCallPage =
    Boolean(call) && pathname.startsWith(`/calls/${call!.id}`);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const next = await getActiveDirectCallSummary();
        if (!cancelled) setCall(next);
      } catch {
        /* ignore */
      }
    };
    void pull();
    const id = window.setInterval(pull, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pathname]);

  useEffect(() => {
    if (!call) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [call?.id]);

  // Keep listening: play stock peer A/V with sound while minimized
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !call || call.status !== "active" || onCallPage) {
      if (el) {
        el.pause();
        el.muted = true;
      }
      return;
    }

    let cancelled = false;
    (async () => {
      await armCallAudio();
      if (cancelled) return;
      el.muted = !speakerOn;
      el.volume = speakerOn ? 1 : 0;
      try {
        await el.play();
      } catch {
        // Autoplay with sound blocked — retry muted then unmute on gesture
        el.muted = true;
        await el.play().catch(() => undefined);
        if (speakerOn) {
          el.muted = false;
          el.volume = 1;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call?.id, call?.status, onCallPage, speakerOn]);

  if (!call) return null;
  if (hideOnCallPage && onCallPage) return null;

  const href = `/calls/${call.id}`;
  const ringing = call.status === "ringing";
  void tick;

  return (
    <>
      <div
        className={cn(
          "relative z-40 flex shrink-0 items-center gap-3 border-b px-3 py-2 md:px-4",
          ringing
            ? "border-warn/30 bg-warn/10"
            : "border-success/25 bg-gradient-to-r from-success/15 via-accent/10 to-transparent"
        )}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              ringing ? "bg-warn" : "bg-success"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              ringing ? "bg-warn" : "bg-success"
            )}
          />
        </span>

        <Avatar name={call.peerName} color={call.peerColor} size="sm" status="online" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">
              {ringing ? "Calling" : "On a call with"} {call.peerName}
            </p>
            <Badge tone={ringing ? "warn" : "success"}>
              {ringing ? "Ringing" : "Live"}
            </Badge>
            {call.privacyMode && <Badge tone="success">Private</Badge>}
            {!ringing && (
              <span className="font-mono text-[11px] text-faint">
                {elapsedLabel(call.answeredAt ?? call.startedAt)}
              </span>
            )}
            {!ringing && (
              <span className="hidden text-[11px] text-faint sm:inline">
                {speakerOn ? "Listening…" : "Speaker muted"}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted">{call.peerTitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!ringing && (
            <Button
              size="icon"
              variant="secondary"
              title={speakerOn ? "Mute speaker" : "Unmute speaker"}
              onClick={() => setSpeakerOn((v) => !v)}
            >
              {speakerOn ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
          )}
          <Link href={href} className={cn(linkBtnSm, "hidden sm:inline-flex")}>
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </Link>
          <Link
            href={href}
            title="Expand call"
            className={cn(linkBtnIcon, "sm:hidden")}
          >
            <Phone className="h-4 w-4" />
          </Link>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                stopRelayRing();
                await playRelayHangup();
                await endDirectCall(call.id);
                setCall(null);
                router.refresh();
              })
            }
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">End</span>
          </Button>
        </div>
      </div>

      {!onCallPage && call.status === "active" && (
        <div className="fixed bottom-4 right-4 z-50 w-[200px] overflow-hidden rounded-relay border border-white/15 bg-[#0a0d12] shadow-pop md:bottom-5 md:right-5 md:w-[240px]">
          <Link href={href} className="group block" title="Expand call">
            <div className="relative aspect-video w-full bg-surface-2">
              <video
                ref={videoRef}
                src={DEMO_PEER_MEDIA}
                autoPlay
                loop
                playsInline
                muted={!speakerOn}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
                <p className="truncate text-[11px] font-medium text-white">
                  {call.peerName}
                </p>
                <p className="text-[10px] text-white/70">
                  {speakerOn ? "Listening · tap to expand" : "Speaker muted · tap to expand"}
                </p>
              </div>
              <span className="absolute left-2 top-2 rounded bg-success/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
                Live
              </span>
            </div>
          </Link>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2 py-1.5">
            <span className="truncate text-[11px] text-white/80">{call.peerTitle}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="relay-focus rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                title={speakerOn ? "Mute speaker" : "Unmute speaker"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSpeakerOn((v) => !v);
                }}
              >
                {speakerOn ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <span className="font-mono text-[10px] text-success">
                {elapsedLabel(call.answeredAt ?? call.startedAt)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
