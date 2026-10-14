/** Turn a looping <video> into a MediaStream for demo peer feeds. */
export function createVideoFileMediaStream(
  src: string,
  onReady?: (stream: MediaStream) => void
): {
  stream: MediaStream
  stop: () => void
} {
  if (typeof document === "undefined") {
    return { stream: new MediaStream(), stop: () => undefined };
  }

  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("playsinline", "true");
  video.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
  document.body.appendChild(video);

  let stopped = false;
  let capture: MediaStream | null = null;
  let audioStop = () => undefined as void;

  const stream = new MediaStream();

  try {
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    oscillator.frequency.value = 180;
    oscillator.connect(gain);
    const dest = audioCtx.createMediaStreamDestination();
    gain.connect(dest);
    oscillator.start();
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
    audioStop = () => {
      try {
        oscillator.stop();
      } catch {
        /* noop */
      }
      void audioCtx.close();
    };
  } catch {
    /* audio optional */
  }

  const startCapture = () => {
    if (stopped || stream.getVideoTracks().length > 0) return;

    const el = video as HTMLVideoElement & {
      captureStream?: (fps?: number) => MediaStream
      mozCaptureStream?: (fps?: number) => MediaStream
    };
    const captureFn = el.captureStream?.bind(video) ?? el.mozCaptureStream?.bind(video);
    if (!captureFn) {
      onReady?.(stream);
      return;
    }

    try {
      capture = captureFn(24);
      for (const track of capture.getVideoTracks()) {
        stream.addTrack(track);
      }
      onReady?.(stream);
    } catch {
      onReady?.(stream);
    }
  };

  const play = () => {
    void video.play().then(startCapture).catch(() => startCapture());
  };

  if (video.readyState >= 2) play();
  else {
    video.addEventListener("loadeddata", play, { once: true });
    video.addEventListener("canplay", play, { once: true });
  }

  return {
    stream,
    stop: () => {
      stopped = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
      capture?.getTracks().forEach((t) => t.stop());
      stream.getTracks().forEach((t) => t.stop());
      audioStop();
    },
  };
}
