"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Phone, PhoneOff, Maximize2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_PEER_MEDIA } from "@/lib/media/demo-media";
import {
  endDirectCall,
  getActiveDirectCallSummary,
  type ActiveDirectCallSummary,
} from "@/lib/actions/direct-call";
import { playRelayHangup, stopRelayRing } from "@/lib/call-sounds";
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

/** Persistent bar + floating mini when a 1:1 call is ringing/active. */
export function OngoingCallBar({
  initial = null,
  hideOnCallPage = true,
}: {
  initial?: ActiveDirectCallSummary | null
  hideOnCallPage?: boolean
}) {
  const [call, setCall] = useState<ActiveDirectCallSummary | null>(initial);
  const [tick, setTick] = useState(0);
  const [pending, start] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

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
          </div>
          <p className="truncate text-[11px] text-muted">{call.peerTitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={href} className={cn(linkBtnSm, "hidden sm:inline-flex")}>
            <Maximize2 className="h-3.5 w-3.5" />
            Return
          </Link>
          <Link
            href={href}
            title="Return to call"
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
        <Link
          href={href}
          className="group fixed bottom-4 right-4 z-50 block w-[200px] overflow-hidden rounded-relay border border-white/15 bg-[#0a0d12] shadow-pop transition hover:border-accent/40 md:bottom-5 md:right-5 md:w-[240px]"
          title="Return to call"
        >
          <div className="relative aspect-video w-full bg-surface-2">
            <video
              src={DEMO_PEER_MEDIA}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
              <p className="truncate text-[11px] font-medium text-white">{call.peerName}</p>
              <p className="text-[10px] text-white/70">Live · tap to return</p>
            </div>
            <span className="absolute left-2 top-2 rounded bg-success/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
              Live
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2.5 py-1.5">
            <span className="truncate text-[11px] text-white/80">{call.peerTitle}</span>
            <span className="font-mono text-[10px] text-success">
              {elapsedLabel(call.answeredAt ?? call.startedAt)}
            </span>
          </div>
        </Link>
      )}
    </>
  );
}
