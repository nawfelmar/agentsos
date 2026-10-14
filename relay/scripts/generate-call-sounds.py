#!/usr/bin/env python3
"""Generate calm, enterprise-soft Relay call sounds into public/sounds/."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "sounds"
SR = 44100


def write_wav(path: Path, samples: list[float], sr: int = SR) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)


def silence(dur: float) -> list[float]:
    return [0.0] * int(SR * dur)


def soft_bell(freq: float, dur: float, vol: float = 0.09) -> list[float]:
    """Warm low-volume bell with long gentle decay — calm, not punchy."""
    n = int(SR * dur)
    out: list[float] = []
    for i in range(n):
        t = i / SR
        env = math.exp(-2.8 * t / max(dur, 0.01))
        if t < 0.02:
            env *= t / 0.02
        s = (
            0.78 * math.sin(2 * math.pi * freq * t)
            + 0.18 * math.sin(2 * math.pi * freq * 2.0 * t) * math.exp(-4 * t)
            + 0.04 * math.sin(2 * math.pi * freq * 3.0 * t) * math.exp(-7 * t)
        )
        s += 0.03 * math.sin(2 * math.pi * (freq * 0.5) * t) * env
        out.append(s * env * vol)
    return out


def airy_pad(freq: float, dur: float, vol: float = 0.045) -> list[float]:
    """Quiet sustained pad for an ambient ring bed."""
    n = int(SR * dur)
    out: list[float] = []
    for i in range(n):
        t = i / SR
        fade = 1.0
        if t < 0.25:
            fade = t / 0.25
        elif t > dur - 0.35:
            fade = max(0.0, (dur - t) / 0.35)
        s = 0.5 * math.sin(2 * math.pi * freq * t)
        s += 0.5 * math.sin(2 * math.pi * (freq * 1.003) * t)
        breath = 0.85 + 0.15 * math.sin(2 * math.pi * 0.35 * t)
        out.append(s * fade * breath * vol)
    return out


def mix(*tracks: list[float]) -> list[float]:
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    peak = max(abs(x) for x in out) or 1.0
    if peak > 0.85:
        out = [x * (0.85 / peak) for x in out]
    return out


def build_ring() -> list[float]:
    # Calm enterprise: quiet G3 pad + soft spaced G3/D4 bells (no PSTN double-ring)
    pad = airy_pad(196.0, 3.2, vol=0.035)
    bell1 = soft_bell(196.0, 1.4, vol=0.07) + silence(1.8)
    bell2 = silence(0.55) + soft_bell(293.66, 1.5, vol=0.065) + silence(1.15)
    return mix(pad, bell1, bell2)


def build_connected() -> list[float]:
    return soft_bell(329.63, 0.55, vol=0.06) + silence(0.1)


def build_hangup() -> list[float]:
    a = soft_bell(293.66, 0.7, vol=0.055)
    b = silence(0.12) + soft_bell(220.0, 0.9, vol=0.05)
    c = silence(0.28) + soft_bell(164.81, 1.1, vol=0.04)
    return mix(a, b, c) + silence(0.15)


if __name__ == "__main__":
    write_wav(OUT / "relay-ring.wav", build_ring())
    write_wav(OUT / "relay-connected.wav", build_connected())
    write_wav(OUT / "relay-hangup.wav", build_hangup())
    print(f"Wrote calm enterprise sounds to {OUT}")
