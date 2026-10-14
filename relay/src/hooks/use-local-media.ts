"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSyntheticMediaStream } from "@/lib/media/synthetic-stream";

export type LocalMediaState = {
  stream: MediaStream | null
  muted: boolean
  camOff: boolean
  error: string | null
  ready: boolean
  usingFallback: boolean
  setMuted: (v: boolean) => void
  setCamOff: (v: boolean) => void
  toggleMute: () => void
  toggleCam: () => void
  stop: () => void
};

/** Acquire microphone + camera; fall back to a synthetic stream if devices are unavailable. */
export function useLocalMedia(
  active: boolean,
  identity?: { name: string; color: string }
): LocalMediaState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [muted, setMutedState] = useState(false);
  const [camOff, setCamOffState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const stopFallbackRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopFallbackRef.current?.();
    stopFallbackRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setReady(false);
    setUsingFallback(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    const attach = (media: MediaStream, fallback: boolean, warn?: string) => {
      if (cancelled) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = media;
      setStream(media);
      setReady(true);
      setUsingFallback(fallback);
      setError(warn ?? null);
      // apply current mute/cam prefs
      media.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
      media.getVideoTracks().forEach((t) => {
        t.enabled = !camOff;
      });
    };

    const useFallback = (reason: string) => {
      const syn = createSyntheticMediaStream({
        name: identity?.name ?? "You",
        color: identity?.color ?? "#5B8DEF",
        subtitle: "Synthetic A/V · no camera device",
      });
      stopFallbackRef.current = syn.stop;
      attach(syn.stream, true, reason);
    };

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        useFallback("Camera/microphone APIs unavailable — using synthetic A/V.");
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        // Prefer real devices when at least one track is live
        if (!media.getVideoTracks().length && !media.getAudioTracks().length) {
          media.getTracks().forEach((t) => t.stop());
          useFallback("No media tracks returned — using synthetic A/V.");
          return;
        }
        attach(media, false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not access camera/microphone";
        useFallback(`${msg} — using synthetic A/V so the call still has video/audio tracks.`);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, identity?.name, identity?.color, stop]);

  const applyMute = useCallback((v: boolean) => {
    setMutedState(v);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !v;
    });
  }, []);

  const applyCam = useCallback((v: boolean) => {
    setCamOffState(v);
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !v;
    });
  }, []);

  return {
    stream,
    muted,
    camOff,
    error,
    ready,
    usingFallback,
    setMuted: applyMute,
    setCamOff: applyCam,
    toggleMute: () => applyMute(!muted),
    toggleCam: () => applyCam(!camOff),
    stop,
  };
}
