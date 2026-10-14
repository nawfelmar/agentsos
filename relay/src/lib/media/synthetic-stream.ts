/** Build a canvas + near-silent audio MediaStream for demo / device-less environments. */
export function createSyntheticMediaStream(opts: {
  name: string
  color: string
  subtitle?: string
}): { stream: MediaStream; stop: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { stream: new MediaStream(), stop: () => undefined };
  }

  let raf = 0;
  let t = 0;
  const draw = () => {
    t += 0.02;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, opts.color);
    g.addColorStop(1, "#0f1419");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 20;
    const r = 70 + Math.sin(t) * 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = opts.color;
    ctx.fill();

    const initials = opts.name
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
    ctx.fillText(opts.name, cx, cy + 110);
    if (opts.subtitle) {
      ctx.font = "400 16px DM Sans, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(opts.subtitle, cx, cy + 142);
    }
    raf = requestAnimationFrame(draw);
  };
  draw();

  const tracks: MediaStreamTrack[] = [];
  const videoTrack = canvas.captureStream(24).getVideoTracks()[0];
  if (videoTrack) tracks.push(videoTrack);

  let audioCtx: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  try {
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    oscillator.frequency.value = 220;
    oscillator.connect(gain);
    const dest = audioCtx.createMediaStreamDestination();
    gain.connect(dest);
    oscillator.start();
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) tracks.push(audioTrack);
  } catch {
    // Audio optional
  }

  const stream = new MediaStream(tracks);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((tr) => tr.stop());
      try {
        oscillator?.stop();
      } catch {
        /* noop */
      }
      void audioCtx?.close();
    },
  };
}
