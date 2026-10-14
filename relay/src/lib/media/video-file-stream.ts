/** Turn a looping <video> into a MediaStream (video + file audio) for demos. */
export function createVideoFileMediaStream(
  src: string,
  onReady?: (stream: MediaStream) => void,
  opts?: { includeVideo?: boolean; includeAudio?: boolean }
): {
  stream: MediaStream
  stop: () => void
} {
  const includeVideo = opts?.includeVideo ?? true;
  const includeAudio = opts?.includeAudio ?? true;

  if (typeof document === "undefined") {
    return { stream: new MediaStream(), stop: () => undefined };
  }

  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  // Keep element silent in the page; audio is played via the MediaStream sink.
  video.muted = false;
  video.volume = 0;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("playsinline", "true");
  video.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
  document.body.appendChild(video);

  let stopped = false;
  let capture: MediaStream | null = null;
  const stream = new MediaStream();

  const startCapture = () => {
    if (stopped) return;
    if (includeVideo && stream.getVideoTracks().length > 0) return;
    if (!includeVideo && includeAudio && stream.getAudioTracks().length > 0) return;

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
      if (includeVideo) {
        for (const track of capture.getVideoTracks()) {
          stream.addTrack(track);
        }
      } else {
        capture.getVideoTracks().forEach((t) => t.stop());
      }
      if (includeAudio) {
        for (const track of capture.getAudioTracks()) {
          stream.addTrack(track);
        }
      } else {
        capture.getAudioTracks().forEach((t) => t.stop());
      }
      onReady?.(stream);
    } catch {
      onReady?.(stream);
    }
  };

  const play = () => {
    void video.play().then(startCapture).catch(() => {
      // Autoplay with audio can fail; retry muted then unmute for capture.
      video.muted = true;
      void video.play().then(() => {
        video.muted = false;
        video.volume = 0;
        startCapture();
      }).catch(() => startCapture());
    });
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
    },
  };
}
