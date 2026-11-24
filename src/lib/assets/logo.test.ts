import { describe, it, expect } from "vitest";
import { validateLogo, placeLogo, logoSlot } from "./logo";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Builds a PNG-shaped buffer: signature, IHDR length and type, then the width
// at bytes 16 to 19 (big-endian). Padded with zeros to totalSize.
function pngBytes(width: number, totalSize = 64): Uint8Array {
  const bytes = new Uint8Array(Math.max(totalSize, 24));
  bytes.set(PNG_SIGNATURE, 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  return bytes;
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const OTHER_FORMAT = "Only PNG or SVG logos are accepted.";
const OVER_SIZE = "Logo is over 2 MB.";
const TOO_NARROW = "PNG logo must be at least 400 px wide.";

describe("validateLogo", () => {
  it("rejects a JPG with the only-PNG-or-SVG reason", () => {
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(validateLogo({ filename: "logo.jpg", bytes: jpgBytes })).toEqual({
      ok: false,
      reason: OTHER_FORMAT,
    });
  });

  it("rejects a PNG-named file whose content is not a PNG", () => {
    expect(validateLogo({ filename: "logo.png", bytes: textBytes("hello") })).toEqual({
      ok: false,
      reason: OTHER_FORMAT,
    });
  });

  it("rejects a 3 MB PNG with the over-2-MB reason", () => {
    const threeMb = pngBytes(1000, 3 * 1024 * 1024);
    expect(validateLogo({ filename: "logo.png", bytes: threeMb })).toEqual({
      ok: false,
      reason: OVER_SIZE,
    });
  });

  it("rejects a 300 px PNG with the 400 px reason", () => {
    expect(validateLogo({ filename: "logo.png", bytes: pngBytes(300) })).toEqual({
      ok: false,
      reason: TOO_NARROW,
    });
  });

  it("accepts a 500 px PNG with width 500", () => {
    expect(validateLogo({ filename: "logo.png", bytes: pngBytes(500) })).toEqual({
      ok: true,
      format: "png",
      width: 500,
    });
  });

  it("accepts an SVG string with width null", () => {
    const svg = textBytes('<?xml version="1.0"?>\n  <svg xmlns="http://www.w3.org/2000/svg" width="10"></svg>');
    expect(validateLogo({ filename: "logo.svg", bytes: svg })).toEqual({
      ok: true,
      format: "svg",
      width: null,
    });
  });

  it("rejects an SVG-named file that does not start with a tag", () => {
    expect(validateLogo({ filename: "logo.svg", bytes: textBytes("not an svg") })).toEqual({
      ok: false,
      reason: OTHER_FORMAT,
    });
  });

  it("accepts uppercase extensions", () => {
    expect(validateLogo({ filename: "LOGO.PNG", bytes: pngBytes(400) })).toEqual({
      ok: true,
      format: "png",
      width: 400,
    });
  });
});

describe("placeLogo", () => {
  const base = { slideWidth: 1080, slideHeight: 1350, size: "small" as const, opacity: 1, logoAspect: 1 };

  it("places top-left 60 px inside the slide edges", () => {
    const p = placeLogo({ ...base, corner: "top-left" });
    expect(p.x).toBe(60);
    expect(p.y).toBe(60);
  });

  it("places top-right 60 px inside the right and top edges", () => {
    const p = placeLogo({ ...base, corner: "top-right" });
    expect(p.x + p.width).toBe(1080 - 60);
    expect(p.y).toBe(60);
  });

  it("places bottom-left 60 px inside the left and bottom edges", () => {
    const p = placeLogo({ ...base, corner: "bottom-left" });
    expect(p.x).toBe(60);
    expect(p.y + p.height).toBe(1350 - 60);
  });

  it("places bottom-right 60 px inside the right and bottom edges", () => {
    const p = placeLogo({ ...base, corner: "bottom-right" });
    expect(p.x + p.width).toBe(1080 - 60);
    expect(p.y + p.height).toBe(1350 - 60);
  });

  it("gives widths of 108, 162 and 216 for small, medium and large on a 1080 px slide", () => {
    expect(placeLogo({ ...base, corner: "top-left", size: "small" }).width).toBe(108);
    expect(placeLogo({ ...base, corner: "top-left", size: "medium" }).width).toBe(162);
    expect(placeLogo({ ...base, corner: "top-left", size: "large" }).width).toBe(216);
  });

  it("derives height from the aspect ratio", () => {
    const p = placeLogo({ ...base, corner: "top-left", logoAspect: 2 });
    expect(p.width).toBe(108);
    expect(p.height).toBe(54);
  });

  it("clamps opacity to the 0.6 to 1.0 range", () => {
    expect(placeLogo({ ...base, corner: "top-left", opacity: 0.2 }).opacity).toBe(0.6);
    expect(placeLogo({ ...base, corner: "top-left", opacity: 1.5 }).opacity).toBe(1);
    expect(placeLogo({ ...base, corner: "top-left", opacity: 0.8 }).opacity).toBe(0.8);
  });
});

describe("logoSlot", () => {
  it("is hidden when no logo file exists, without throwing", () => {
    expect(() => logoSlot({ logoPresent: false, enabled: true })).not.toThrow();
    expect(logoSlot({ logoPresent: false, enabled: true })).toBe("hidden");
  });

  it("is shown when a logo exists and the feature is on", () => {
    expect(logoSlot({ logoPresent: true, enabled: true })).toBe("shown");
  });

  it("is hidden when the feature is off even if a logo exists", () => {
    expect(logoSlot({ logoPresent: true, enabled: false })).toBe("hidden");
  });
});
