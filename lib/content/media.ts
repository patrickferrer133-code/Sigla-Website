import "server-only";
import sharp from "sharp";
import { stripJpegMetadataSegments } from "@/lib/domain/image-metadata";

// docs/04 section 3.3 and docs/06 section 7: images are stripped of EXIF,
// including GPS, on upload. Post media goes to a public bucket, so anything
// left in the file is permanently public.
//
// Re-encoding with sharp drops all metadata by default. Do not add
// .withMetadata() here — that is precisely the call that would put the EXIF
// (and the GPS tags in it) back.
//
// Residual risk, knowingly accepted for this pass and flagged by the safety
// review: video files are uploaded as-is, so container-level location atoms
// in an MP4/MOV are not stripped. Video sanitisation needs a transcode step
// (docs/04 section 1 puts transcoding in phase 2) and is tracked separately.

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const IMAGE_EXTENSION: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function reencode(bytes: Uint8Array, mime: ImageMime): Promise<Uint8Array> {
  const input = sharp(bytes, { animated: mime === "image/gif" || mime === "image/webp" });
  switch (mime) {
    case "image/jpeg":
      return await input.jpeg({ quality: 82 }).toBuffer();
    case "image/png":
      return await input.png().toBuffer();
    case "image/webp":
      return await input.webp().toBuffer();
    case "image/gif":
      return await input.gif().toBuffer();
  }
}

/**
 * Returns metadata-free bytes for an uploaded image, or null when the file
 * cannot be sanitised at all — in which case the caller must reject it
 * rather than upload the original.
 */
export async function stripImageMetadata(bytes: Uint8Array, mime: ImageMime): Promise<Uint8Array | null> {
  try {
    return await reencode(bytes, mime);
  } catch {
    // sharp could not decode the pixels (truncated or corrupt upload). The
    // metadata segments are still readable to anyone who downloads the
    // object, so fall back to a container-level strip for JPEG. For any
    // other format we cannot guarantee a clean file, so return null and let
    // the caller reject the upload.
    if (mime === "image/jpeg") return stripJpegMetadataSegments(bytes);
    return null;
  }
}
