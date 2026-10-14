"use client";

import { useEffect, useState } from "react";
import { createSyntheticMediaStream } from "@/lib/media/synthetic-stream";

/** Synthetic peer MediaStream for single-browser 1:1 demos. */
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
    const syn = createSyntheticMediaStream({
      name: peer.name,
      color: peer.color,
      subtitle: "Connected · demo peer stream",
    });
    setStream(syn.stream);
    return () => {
      syn.stop();
      setStream(null);
    };
  }, [active, peer.color, peer.name]);

  return stream;
}
