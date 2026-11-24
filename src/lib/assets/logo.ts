// Logo validation and placement. Pure functions over file bytes.
// No file system access here. The caller reads the file and passes the bytes in.

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MIN_PNG_WIDTH = 400;
export const LOGO_MARGIN = 60;

const FORMAT_REASON = "Only PNG or SVG logos are accepted.";
const SIZE_REASON = "Logo is over 2 MB.";
const WIDTH_REASON = "PNG logo must be at least 400 px wide.";

export type LogoValidation =
  | { ok: true; format: "png" | "svg"; width: number | null }
  | { ok: false; reason: string };

export type LogoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type LogoSize = "small" | "medium" | "large";

export type LogoPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

const SIZE_FRACTION: Record<LogoSize, number> = {
  small: 0.1,
  medium: 0.15,
  large: 0.2,
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_MAGIC.every((byte, i) => bytes[i] === byte);
}

function isSvg(bytes: Uint8Array): boolean {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const trimmed = text.replace(/^\s+/, "");
  return trimmed.startsWith("<") && text.includes("<svg");
}

function readPngWidth(bytes: Uint8Array): number {
  if (bytes.length < 20) return 0;
  // IHDR width: bytes 16 to 19, big-endian.
  return ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
}

export function validateLogo(input: {
  filename: string;
  bytes: Uint8Array;
}): LogoValidation {
  const { filename, bytes } = input;
  const ext = extensionOf(filename);

  if (ext === "png") {
    if (!isPng(bytes)) return { ok: false, reason: FORMAT_REASON };
  } else if (ext === "svg") {
    if (!isSvg(bytes)) return { ok: false, reason: FORMAT_REASON };
  } else {
    return { ok: false, reason: FORMAT_REASON };
  }

  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, reason: SIZE_REASON };

  if (ext === "svg") return { ok: true, format: "svg", width: null };

  const width = readPngWidth(bytes);
  if (width < MIN_PNG_WIDTH) return { ok: false, reason: WIDTH_REASON };
  return { ok: true, format: "png", width };
}

export function placeLogo(input: {
  slideWidth: number;
  slideHeight: number;
  corner: LogoCorner;
  size: LogoSize;
  opacity: number;
  logoAspect: number;
}): LogoPlacement {
  const { slideWidth, slideHeight, corner, size, opacity, logoAspect } = input;

  const width = Math.round(slideWidth * SIZE_FRACTION[size]);
  const aspect = Number.isFinite(logoAspect) && logoAspect > 0 ? logoAspect : 1;
  const height = Math.round(width / aspect);

  const left = LOGO_MARGIN;
  const right = slideWidth - LOGO_MARGIN - width;
  const top = LOGO_MARGIN;
  const bottom = slideHeight - LOGO_MARGIN - height;

  const x = corner.endsWith("left") ? left : right;
  const y = corner.startsWith("top") ? top : bottom;

  const safeOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0.6, opacity)) : 1;

  return { x, y, width, height, opacity: safeOpacity };
}

export function logoSlot(input: { logoPresent: boolean; enabled: boolean }): "shown" | "hidden" {
  return input.logoPresent && input.enabled ? "shown" : "hidden";
}
