"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_PEER_MEDIA } from "@/lib/media/demo-media";
import { createSyntheticMediaStream } from "@/lib/media/synthetic-stream";
import { createVideoFileMediaStream } from "@/lib/media/video-file-stream";

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

/**
 * Local call media: real/synthetic camera + audio from the demo stock file
 * (replaces the microphone in single-browser demos).
 */
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
  const stopExtrasRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopExtrasRef.current?.();
    stopExtrasRef.current = null;
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
      media.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
      media.getVideoTracks().forEach((t) => {
        t.enabled = !camOff;
      });
    };

    const withDemoAudio = (
      videoStream: MediaStream,
      fallback: boolean,
      warn?: string
    ) => {
      // Drop real mic tracks — demo uses stock-file audio instead.
      videoStream.getAudioTracks().forEach((t) => {
        videoStream.removeTrack(t);
        t.stop();
      });

      const composed = new MediaStream(videoStream.getVideoTracks());
      const file = createVideoFileMediaStream(
        DEMO_PEER_MEDIA,
        (readyStream) => {
          if (cancelled) return;
          for (const track of readyStream.getAudioTracks()) {
            if (!composed.getAudioTracks().some((t) => t.id === track.id)) {
              composed.addTrack(track);
            }
          }
          composed.getAudioTracks().forEach((t) => {
            t.enabled = !muted;
          });
          attach(composed, fallback, warn);
        },
        { includeVideo: false, includeAudio: true }
      );

      const prevStop = stopExtrasRef.current;
      stopExtrasRef.current = () => {
        file.stop();
        prevStop?.();
      };

      // If audio is already present, attach immediately; otherwise wait for onReady.
      if (file.stream.getAudioTracks().length > 0) {
        for (const track of file.stream.getAudioTracks()) {
          composed.addTrack(track);
        }
        attach(composed, fallback, warn);
      } else {
        // Show video while audio catch-up is in flight
        attach(composed, fallback, warn);
      }
    };

    const useFallback = (reason: string) => {
      const syn = createSyntheticMediaStream({
        name: identity?.name ?? "You",
        color: identity?.color ?? "#5B8DEF",
        subtitle: "Synthetic camera · demo file audio",
      });
      const prev = stopExtrasRef.current;
      stopExtrasRef.current = () => {
        syn.stop();
        prev?.();
      };
      withDemoAudio(syn.stream, true, `${reason} Audio from demo video.`);
    };

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        useFallback("Camera/microphone APIs unavailable — using synthetic camera.");
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
        if (!media.getVideoTracks().length && !media.getAudioTracks().length) {
          media.getTracks().forEach((t) => t.stop());
          useFallback("No media tracks returned — using synthetic camera.");
          return;
        }
        withDemoAudio(media, false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not access camera/microphone";
        useFallback(`${msg} — using synthetic camera.`);
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
