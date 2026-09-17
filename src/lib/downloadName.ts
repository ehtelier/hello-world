// Builds the filename attendees see when they download a photo/video, e.g.
// "PPC 001 Marais 003.jpg". Only affects the Content-Disposition header on
// download; the original bytes and metadata in R2 are never touched.
export function buildDownloadFilename(
  eventName: string,
  sequence: number,
  originalFilename: string
): string {
  const safeEventName = eventName.replace(/[\\/:*?"<>|]/g, "").trim() || "event";
  const paddedSequence = String(sequence).padStart(3, "0");
  const dotIndex = originalFilename.lastIndexOf(".");
  const extension = dotIndex > -1 ? originalFilename.slice(dotIndex) : "";
  return `${safeEventName} ${paddedSequence}${extension}`;
}
