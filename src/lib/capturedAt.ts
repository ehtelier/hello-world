import exifr from "exifr";

// Runs in the browser, before upload. Tries the photo's own embedded
// capture date first (most authoritative), then falls back to the file's
// "last modified" date, which is usually close enough for videos and
// anything without readable EXIF (screenshots, edited images, etc.).
export async function getCapturedAt(file: File): Promise<string | null> {
  if (file.type.startsWith("image/")) {
    try {
      const tags = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
      const date = tags?.DateTimeOriginal ?? tags?.CreateDate;
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Unsupported format or no EXIF data; fall through.
    }
  }

  if (file.lastModified) {
    const date = new Date(file.lastModified);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}
