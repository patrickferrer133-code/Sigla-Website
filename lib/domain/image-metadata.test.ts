import { describe, expect, it } from "vitest";
import { stripJpegMetadataSegments } from "./image-metadata";

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

describe("stripJpegMetadataSegments", () => {
  it("returns null for a non-JPEG", () => {
    expect(stripJpegMetadataSegments(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(stripJpegMetadataSegments(new Uint8Array([]))).toBeNull();
  });

  it("removes an APP1 EXIF segment", () => {
    const exif = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x11, 0x22]);
    const input = new Uint8Array([...SOI, ...exif, ...segment(0xdb, [0x01, 0x02]), ...EOI]);
    const out = stripJpegMetadataSegments(input)!;

    expect(Array.from(out)).toEqual([...SOI, ...segment(0xdb, [0x01, 0x02]), ...EOI]);
    expect(Array.from(out).join(",")).not.toContain(exif.join(","));
  });

  it("removes every APPn above APP0 and the comment marker, keeping JFIF", () => {
    const jfif = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]);
    const input = new Uint8Array([
      ...SOI,
      ...jfif,
      ...segment(0xe1, [0xaa]),
      ...segment(0xed, [0xbb]),
      ...segment(0xef, [0xcc]),
      ...segment(0xfe, [0xdd]),
      ...EOI,
    ]);
    const out = Array.from(stripJpegMetadataSegments(input)!);

    expect(out).toEqual([...SOI, ...jfif, ...EOI]);
  });

  it("drops a truncated metadata segment rather than passing it through", () => {
    // A declared 16-byte APP1 with no payload actually present: exactly the
    // shape of an upload that was cut off mid-transfer.
    const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);
    const out = Array.from(stripJpegMetadataSegments(input)!);
    expect(out).toEqual(SOI);
  });

  it("keeps scan data intact once SOS is reached", () => {
    const scan = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0x56, ...EOI];
    const input = new Uint8Array([...SOI, ...segment(0xe1, [0xaa, 0xbb]), ...scan]);
    expect(Array.from(stripJpegMetadataSegments(input)!)).toEqual([...SOI, ...scan]);
  });

  it("preserves standalone and restart markers", () => {
    const input = new Uint8Array([...SOI, 0xff, 0xd0, 0xff, 0xd7, ...EOI]);
    expect(Array.from(stripJpegMetadataSegments(input)!)).toEqual([...SOI, 0xff, 0xd0, 0xff, 0xd7, ...EOI]);
  });

  it("never returns the input instance", () => {
    const input = new Uint8Array([...SOI, ...EOI]);
    expect(stripJpegMetadataSegments(input)).not.toBe(input);
  });
});
