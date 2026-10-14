"use client";

type SoundName = "ring" | "hangup" | "connected";

const SRC: Record<SoundName, string> = {
  ring: "/sounds/relay-ring.wav",
  hangup: "/sounds/relay-hangup.wav",
  connected: "/sounds/relay-connected.wav",
};

let sharedCtx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
let ringSource: AudioBufferSourceNode | null = null;
let ringGain: GainNode | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

async function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return cached;
  const ctx = getCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(SRC[name]);
    const raw = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(raw.slice(0));
    buffers.set(name, buf);
    return buf;
  } catch {
    return null;
  }
}

async function playOnce(name: SoundName, volume = 0.55) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  const buf = await loadBuffer(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
}

/** Start looping the Relay ring motif (caller side). */
export async function startRelayRing() {
  stopRelayRing();
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  const buf = await loadBuffer("ring");
  if (!buf) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.buffer = buf;
  src.loop = true;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
  ringSource = src;
  ringGain = gain;
}

export function stopRelayRing() {
  try {
    ringSource?.stop(0);
  } catch {
    /* already stopped */
  }
  try {
    ringSource?.disconnect();
    ringGain?.disconnect();
  } catch {
    /* noop */
  }
  ringSource = null;
  ringGain = null;
}

export async function playRelayConnected() {
  stopRelayRing();
  await playOnce("connected", 0.5);
}

export async function playRelayHangup() {
  stopRelayRing();
  await playOnce("hangup", 0.6);
}

/** Warm the AudioContext after a user gesture (Call click). */
export async function armCallAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  await Promise.all([loadBuffer("ring"), loadBuffer("hangup"), loadBuffer("connected")]);
}
