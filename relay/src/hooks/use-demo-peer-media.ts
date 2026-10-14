"use client";

import { useEffect, useState } from "react";
import { createSyntheticMediaStream } from "@/lib/media/synthetic-stream";
import { createVideoFileMediaStream } from "@/lib/media/video-file-stream";

const DEMO_PEER_VIDEO = "/media/demo-peer.mp4";

/** Demo peer MediaStream: looping stock video, with canvas fallback. */
export function useDemoPeerMedia(
  active: boolean,
  peer: { name: string; color: string }
) {
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      setStream(null);
      return;
    }

    let syn: { stream: MediaStream; stop: () => void } | null = null;
    let usingFile = false;

    const fromFile = createVideoFileMediaStream(DEMO_PEER_VIDEO, (ready) => {
      if (ready.getVideoTracks().length > 0) {
        usingFile = true;
        syn?.stop();
        syn = null;
        setStream(ready);
      }
    });

    // Fallback if the file can't produce a video track quickly
    const timer = window.setTimeout(() => {
      if (usingFile || fromFile.stream.getVideoTracks().length > 0) {
        usingFile = true;
        setStream(fromFile.stream);
        return;
      }
      syn = createSyntheticMediaStream({
        name: peer.name,
        color: peer.color,
        subtitle: "Connected · demo peer stream",
      });
      setStream(syn.stream);
    }, 900);

    return () => {
      window.clearTimeout(timer);
      fromFile.stop();
      syn?.stop();
      setStream(null);
    };
  }, [active, peer.color, peer.name]);

  return stream;
}
