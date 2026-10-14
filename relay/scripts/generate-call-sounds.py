#!/usr/bin/env python3
"""Generate Relay-branded call sounds (ring / connected / hang-up) into public/sounds/."""

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


def env_adsr(n: int, a=0.01, d=0.05, s=0.7, r=0.08) -> list[float]:
    ea, ed, er = int(a * n), int(d * n), int(r * n)
    es = max(0, n - ea - ed - er)
    e: list[float] = []
    for i in range(ea):
        e.append(i / max(1, ea))
    for i in range(ed):
        e.append(1 - (1 - s) * i / max(1, ed))
    e.extend([s] * es)
    for i in range(er):
        e.append(s * (1 - i / max(1, er)))
    while len(e) < n:
        e.append(0.0)
    return e[:n]


def tone(freq: float, dur: float, vol=0.28, vibrato_hz=0.0, vibrato_cents=0.0) -> list[float]:
    n = int(SR * dur)
    e = env_adsr(n, a=0.008, d=0.04, s=0.65, r=0.12)
    out: list[float] = []
    for i in range(n):
        t = i / SR
        f = freq
        if vibrato_hz:
            f *= 2 ** ((vibrato_cents / 1200) * math.sin(2 * math.pi * vibrato_hz * t))
        phase = 2 * math.pi * f * t
        s = 0.72 * math.sin(phase) + 0.22 * math.sin(2 * phase) + 0.06 * math.sin(3 * phase)
        out.append(s * e[i] * vol)
    return out


def silence(dur: float) -> list[float]:
    return [0.0] * int(SR * dur)


def build_ring() -> list[float]:
    # Soft "Re-lay" motif (A4 → E5 → C♯5), dual pulse — Relay-specific, not PSTN harsh
    motif = (
        tone(440.0, 0.14, vol=0.22)
        + tone(659.25, 0.16, vol=0.24, vibrato_hz=5.5, vibrato_cents=6)
        + tone(554.37, 0.18, vol=0.18)
        + silence(0.12)
    )
    return motif + silence(0.55) + motif + silence(0.7)


def build_hangup() -> list[float]:
    return tone(659.25, 0.09, vol=0.2) + tone(440.0, 0.11, vol=0.18) + tone(185.0, 0.22, vol=0.16) + silence(0.08)


def build_connected() -> list[float]:
    return tone(523.25, 0.06, vol=0.16) + tone(784.0, 0.09, vol=0.18) + silence(0.05)


if __name__ == "__main__":
    write_wav(OUT / "relay-ring.wav", build_ring())
    write_wav(OUT / "relay-hangup.wav", build_hangup())
    write_wav(OUT / "relay-connected.wav", build_connected())
    print(f"Wrote sounds to {OUT}")
