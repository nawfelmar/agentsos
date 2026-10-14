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
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("playsinline", "true");
  // Unmuted so WebAudio / captureStream can read the soundtrack.
  // createMediaElementSource disconnects the element from speakers, so this
  // stays silent until a sink (VideoTile) plays the resulting MediaStream.
  video.muted = false;
  video.volume = 1;
  video.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
  document.body.appendChild(video);

  let stopped = false;
  let capture: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  const stream = new MediaStream();

  const finish = () => {
    if (!stopped) onReady?.(stream);
  };

  const startCapture = async () => {
    if (stopped) return;
    if (includeVideo && stream.getVideoTracks().length > 0) return;
    if (!includeVideo && includeAudio && stream.getAudioTracks().length > 0) return;

    const el = video as HTMLVideoElement & {
      captureStream?: (fps?: number) => MediaStream
      mozCaptureStream?: (fps?: number) => MediaStream
    };
    const captureFn = el.captureStream?.bind(video) ?? el.mozCaptureStream?.bind(video);

    try {
      if (captureFn && includeVideo) {
        capture = captureFn(24);
        for (const track of capture.getVideoTracks()) {
          stream.addTrack(track);
        }
        // Prefer WebAudio for soundtrack; drop captureStream audio to avoid doubles.
        if (!includeAudio) {
          capture.getAudioTracks().forEach((t) => t.stop());
        }
      }

      if (includeAudio) {
        let gotAudio = false;
        try {
          audioCtx = new AudioContext();
          if (audioCtx.state === "suspended") {
            await audioCtx.resume();
          }
          const source = audioCtx.createMediaElementSource(video);
          const gain = audioCtx.createGain();
          gain.gain.value = 1;
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(gain);
          gain.connect(dest);
          // Intentionally not connected to audioCtx.destination — playback is via VideoTile.
          for (const track of dest.stream.getAudioTracks()) {
            stream.addTrack(track);
            gotAudio = true;
          }
        } catch {
          // Fall back to captureStream audio tracks
          if (captureFn) {
            const cap = capture ?? captureFn(24);
            for (const track of cap.getAudioTracks()) {
              stream.addTrack(track);
              gotAudio = true;
            }
          }
        }

        // Last resort: captureStream may have attached audio already
        if (!gotAudio && capture) {
          for (const track of capture.getAudioTracks()) {
            if (!stream.getAudioTracks().some((t) => t.id === track.id)) {
              stream.addTrack(track);
            }
          }
        }
      } else if (capture) {
        capture.getAudioTracks().forEach((t) => t.stop());
      }

      finish();
    } catch {
      finish();
    }
  };

  const play = () => {
    void video
      .play()
      .then(() => startCapture())
      .catch(() => {
        // Autoplay with sound can fail before a gesture; try muted then unmute.
        video.muted = true;
        void video
          .play()
          .then(() => {
            video.muted = false;
            return startCapture();
          })
          .catch(() => startCapture());
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
      void audioCtx?.close();
    },
  };
}
