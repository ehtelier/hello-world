// Grabs a frame from a video file in the browser and returns it as a small
// JPEG blob, used as the video's preview image in the gallery grid (video
// elements don't reliably show a frame on their own without one).
export function captureVideoThumbnail(file: File): Promise<Blob | null> {
  const MAX_DIMENSION = 480;
  const SEEK_TIME = 0.1; // avoids the often-black very first frame

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.remove();
      resolve(result);
    };

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    // Mobile Safari in particular can be unreliable loading/seeking a
    // video that isn't actually attached to the page; keep it in the
    // document but visually and interactively invisible.
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = async () => {
      try {
        // Some browsers only decode frames once playback has actually
        // started at least momentarily; a muted, inline play/pause forces
        // that without ever being visibly noticeable.
        await video.play();
        video.pause();
      } catch {
        // Autoplay could be blocked; still try seeking directly below.
      }
      video.currentTime = Math.min(SEEK_TIME, video.duration || 0);
    };

    video.onseeked = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx || canvas.width === 0 || canvas.height === 0) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.8);
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);

    // Some browsers/formats never fire loadedmetadata/seeked; don't hang.
    setTimeout(() => finish(null), 8000);
  });
}
