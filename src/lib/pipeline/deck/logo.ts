import { promises as fs } from "node:fs";
import { placeLogo, validateLogo } from "../../assets/logo";
import type { LogoOptions } from "../../render/render";
import { resolveContentPath } from "../../store/paths";
import type { LogoSettings } from "./extras";
import { isNotFound, RouteError } from "./http";

// Slide size from doc 03 section 2 (Instagram and LinkedIn carousel).
export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export type LogoFile = { format: "png" | "svg"; rel: string; file: string; bytes: Uint8Array };

// Looks for content/assets/logo.png, then logo.svg. Returns null when neither exists.
export async function findLogoFile(): Promise<LogoFile | null> {
  for (const format of ["png", "svg"] as const) {
    const rel = `assets/logo.${format}`;
    const file = resolveContentPath(rel);
    try {
      const bytes = new Uint8Array(await fs.readFile(file));
      return { format, rel, file, bytes };
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }
  return null;
}

export async function logoStatus(): Promise<
  { present: true; format: "png" | "svg"; width?: number } | { present: false; reason?: string }
> {
  const logo = await findLogoFile();
  if (!logo) return { present: false };
  const result = validateLogo({ filename: logo.rel, bytes: logo.bytes });
  if (!result.ok) return { present: false, reason: result.reason };
  return result.width === null ? { present: true, format: result.format } : { present: true, format: result.format, width: result.width };
}

// Saves an uploaded logo only when it passes validateLogo. Nothing is written on rejection.
// With replace, any earlier logo file is removed first (the user asked for the swap).
export async function saveLogo(input: {
  filename: string;
  bytes: Uint8Array;
  replace: boolean;
}): Promise<{ accepted: true; format: "png" | "svg"; width?: number } | { accepted: false; reason: string }> {
  const result = validateLogo(input);
  if (!result.ok) return { accepted: false, reason: result.reason };

  const existing = await findLogoFile();
  if (existing && !input.replace) {
    throw new RouteError(409, "logo_exists", "A logo is already saved. Send replace: true to swap it.");
  }
  if (existing) {
    for (const format of ["png", "svg"] as const) {
      await fs.rm(resolveContentPath(`assets/logo.${format}`), { force: true });
    }
  }
  await fs.mkdir(resolveContentPath("assets"), { recursive: true });
  await fs.writeFile(resolveContentPath(`assets/logo.${result.format}`), input.bytes);
  return result.width === null
    ? { accepted: true, format: result.format }
    : { accepted: true, format: result.format, width: result.width };
}

function logoAspect(logo: LogoFile): number {
  if (logo.format === "png") {
    const view = new DataView(logo.bytes.buffer, logo.bytes.byteOffset, logo.bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return height > 0 ? width / height : 1;
  }
  const text = new TextDecoder("utf-8").decode(logo.bytes);
  const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(text);
  if (box && Number(box[2]) > 0) return Number(box[1]) / Number(box[2]);
  return 1;
}

// Placement in absolute pixels (doc 03 section 9) for one logo file and the deck's logo settings.
export function logoOptionsFor(logo: LogoFile, settings: LogoSettings): LogoOptions {
  const check = validateLogo({ filename: logo.rel, bytes: logo.bytes });
  if (!check.ok) throw new RouteError(422, "logo_invalid", check.reason);
  const placement = placeLogo({
    slideWidth: SLIDE_WIDTH,
    slideHeight: SLIDE_HEIGHT,
    corner: settings.corner,
    size: settings.size,
    opacity: settings.opacity,
    logoAspect: logoAspect(logo),
  });
  return { ...placement, src: logo.file };
}
