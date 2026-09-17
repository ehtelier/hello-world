import { NextRequest } from "next/server";
import { verifyAndLogDownload } from "@/lib/downloadTracking";

// Fired by the client the moment a photo opens full-screen in the lightbox,
// since that's the point right before someone would press-and-hold to save
// it, an action no website can observe directly. No file is served here;
// the image is already loaded separately for display.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const code = request.nextUrl.searchParams.get("code") ?? "";

  const result = await verifyAndLogDownload(photoId, code);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, { status: 204 });
}
