"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LocalMediaState = {
  stream: MediaStream | null
  muted: boolean
  camOff: boolean
  error: string | null
  ready: boolean
  setMuted: (v: boolean) => void
  setCamOff: (v: boolean) => void
  toggleMute: () => void
  toggleCam: () => void
  stop: () => void
};

/** Acquire real microphone + camera via getUserMedia and wire mute/cam toggles. */
export function useLocalMedia(active: boolean): LocalMediaState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [muted, setMutedState] = useState(false);
  const [camOff, setCamOffState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setReady(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera/microphone APIs are not available in this browser.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = media;
        setStream(media);
        setReady(true);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not access camera/microphone";
        setError(msg);
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

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
    setMuted: applyMute,
    setCamOff: applyCam,
    toggleMute: () => applyMute(!muted),
    toggleCam: () => applyCam(!camOff),
    stop,
  };
}
