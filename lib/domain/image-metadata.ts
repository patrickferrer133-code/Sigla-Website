// docs/06 section 7 / docs/04 section 3.3: images must reach storage with
// EXIF (including GPS) stripped. The primary strip is a full re-encode with
// sharp (see lib/content/media.ts). This module is the container-level
// fallback for JPEGs sharp cannot decode (truncated or otherwise corrupt
// uploads, which are common from mobile browsers on flaky connections):
// even when the pixels are unreadable, the APP1 EXIF block is perfectly
// readable to anyone who downloads the object, so it still has to go.
//
// Pure byte manipulation, no I/O, per the /lib/domain rule.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const TEM = 0x01;
const RST_FIRST = 0xd0;
const RST_LAST = 0xd7;
const APP0 = 0xe0;
const APP_LAST = 0xef;
const COM = 0xfe;

/** APP1 (EXIF/XMP) through APP15, plus the comment marker. APP0 (JFIF) is
 *  kept: it carries no user, device, or location data. */
function isMetadataMarker(marker: number): boolean {
  return marker === COM || (marker > APP0 && marker <= APP_LAST);
}

function isStandalone(marker: number): boolean {
  return marker === SOI || marker === EOI || marker === TEM || (marker >= RST_FIRST && marker <= RST_LAST);
}

/**
 * Rewrites a JPEG byte stream with every metadata segment removed.
 * Returns null if the input is not a JPEG (caller should reject rather than
 * upload something it cannot reason about).
 */
export function stripJpegMetadataSegments(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;

  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;

  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      // Not at a marker boundary: the stream is malformed from here on. Keep
      // nothing further — trailing bytes we cannot parse could be anything,
      // including the metadata we are trying to remove.
      break;
    }

    const marker = bytes[i + 1];

    if (marker === 0xff) {
      // Fill byte, skip it.
      i += 1;
      continue;
    }

    if (isStandalone(marker)) {
      kept.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (marker === SOS) {
      // Start of scan: everything from here to the end is entropy-coded
      // image data (plus a trailing EOI). No metadata segments live inside.
      kept.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }

    if (i + 3 >= bytes.length) break;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) break;

    const end = Math.min(i + 2 + length, bytes.length);
    if (!isMetadataMarker(marker)) kept.push(bytes.subarray(i, end));
    i = end;
  }

  let total = 0;
  for (const chunk of kept) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of kept) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
