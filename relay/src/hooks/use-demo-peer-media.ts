"use client";

import { useEffect, useState } from "react";
import { DEMO_PEER_MEDIA } from "@/lib/media/demo-media";
import { createSyntheticMediaStream } from "@/lib/media/synthetic-stream";
import { createVideoFileMediaStream } from "@/lib/media/video-file-stream";

/** Demo peer MediaStream: looping stock video+audio, with canvas fallback. */
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

    const fromFile = createVideoFileMediaStream(DEMO_PEER_MEDIA, (ready) => {
      if (ready.getVideoTracks().length > 0) {
        usingFile = true;
        syn?.stop();
        syn = null;
        setStream(ready);
      }
    });

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
