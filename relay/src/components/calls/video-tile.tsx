"use client";

import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function VideoTile({
  stream,
  name,
  color,
  muted = false,
  camOff = false,
  mirrored = false,
  label,
  className,
}: {
  stream?: MediaStream | null
  name: string
  color: string
  muted?: boolean
  camOff?: boolean
  mirrored?: boolean
  label?: string
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream && !camOff) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [stream, camOff]);

  const showVideo = Boolean(stream && !camOff);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-relay border border-line bg-canvas",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Always mute the element for autoplay; call mute state is track.enabled
        muted
        className={cn(
          "h-full w-full object-cover",
          mirrored && "scale-x-[-1]",
          !showVideo && "invisible absolute inset-0"
        )}
      />
      {!showVideo && (
        <div className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-3 bg-surface-2">
          <Avatar name={name} color={color} size="lg" />
          <p className="text-sm font-medium text-ink">{name}</p>
          {camOff && (
            <p className="flex items-center gap-1 text-[11px] text-faint">
              <VideoOff className="h-3 w-3" /> Camera off
            </p>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">{name}</p>
          {label && <p className="text-[10px] text-white/70">{label}</p>}
        </div>
        {muted && (
          <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            <MicOff className="h-3 w-3" /> Muted
          </span>
        )}
      </div>
    </div>
  );
}
