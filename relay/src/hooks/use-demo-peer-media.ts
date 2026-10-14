"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Synthetic peer video/audio for single-browser 1:1 demos (no second client).
 * Draws an animated tile so the remote pane is a real MediaStream, not a static stub.
 */
export function useDemoPeerMedia(
  active: boolean,
  peer: { name: string; color: string }
) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      setStream(null);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001; // near-silent carrier so an audio track exists
    oscillator.frequency.value = 220;
    oscillator.connect(gain);
    const dest = audioCtx.createMediaStreamDestination();
    gain.connect(dest);
    oscillator.start();

    let t = 0;
    const draw = () => {
      t += 0.02;
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, peer.color);
      g.addColorStop(1, "#0f1419");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // soft pulse ring
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 - 20;
      const r = 70 + Math.sin(t) * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fillStyle = peer.color;
      ctx.fill();

      const initials = peer.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      ctx.fillStyle = "#fff";
      ctx.font = "600 36px DM Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, cx, cy);

      ctx.font = "500 28px DM Sans, sans-serif";
      ctx.fillText(peer.name, cx, cy + 110);
      ctx.font = "400 16px DM Sans, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("Connected · demo peer stream", cx, cy + 142);

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const videoTrack = canvas.captureStream(24).getVideoTracks()[0];
    const audioTrack = dest.stream.getAudioTracks()[0];
    const media = new MediaStream(
      [videoTrack, audioTrack].filter(Boolean) as MediaStreamTrack[]
    );
    setStream(media);

    return () => {
      cancelAnimationFrame(rafRef.current);
      media.getTracks().forEach((tr) => tr.stop());
      oscillator.stop();
      void audioCtx.close();
      setStream(null);
    };
  }, [active, peer.color, peer.name]);

  return stream;
}
