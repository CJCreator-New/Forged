import { promises as fs } from "node:fs";
import path from "node:path";
import { DeckSchema } from "../schemas/deck";
import { resolveContentPath } from "../store/paths";
import { ExportError } from "./errors";
import { zipBuffer } from "./zip";

// Deck exports only read files that renderDeck already wrote. They never render and never launch a browser.
// Renders are expected in a renders/ folder next to the deck JSON (doc 04 section 2).

export type DeckKind = "pdf" | "png";
export type DeckExport = { body: Buffer; contentType: string; filename: string };

const NOT_RENDERED = "Render this deck first.";

function slideName(index: number): string {
  return `slide-${String(index + 1).padStart(2, "0")}.png`;
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(relPath));
    return true;
  } catch {
    return false;
  }
}

function assertDeckPath(deckRelPath: string): void {
  if (typeof deckRelPath !== "string" || !deckRelPath.endsWith(".json")) {
    throw new ExportError("bad_path", "Deck path must end in .json.");
  }
  try {
    resolveContentPath(deckRelPath);
  } catch {
    throw new ExportError("bad_path", "Deck path must be inside content/.");
  }
}

// Exports a deck as deck.pdf, or as a ZIP of slide-01.png to slide-NN.png and alt.txt.
export async function exportDeck(deckRelPath: string, kind: DeckKind): Promise<DeckExport> {
  if (kind !== "pdf" && kind !== "png") {
    throw new ExportError("bad_request", "Kind must be pdf or png.");
  }
  assertDeckPath(deckRelPath);
  if (!(await fileExists(deckRelPath))) {
    throw new ExportError("not_found", `Deck not found: ${deckRelPath}`);
  }
  const raw = await fs.readFile(resolveContentPath(deckRelPath), "utf8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new ExportError("invalid_deck", "Deck file is not valid JSON.");
  }
  const parsed = DeckSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ExportError("invalid_deck", "Deck file does not match the deck rules.");
  }
  const deck = parsed.data;

  const dir = path.posix.dirname(deckRelPath);
  const stem = path.posix.basename(deckRelPath, ".json");
  // Each channel renders into its own folder, renders/<channel>/, so two decks never overwrite each other.
  const rendersRel = path.posix.join(dir, "renders", stem.replace(/-deck$/, ""));

  if (kind === "pdf") {
    const pdfRel = path.posix.join(rendersRel, "deck.pdf");
    if (!(await fileExists(pdfRel))) throw new ExportError("not_rendered", NOT_RENDERED);
    const body = await fs.readFile(resolveContentPath(pdfRel));
    return { body, contentType: "application/pdf", filename: `${stem}.pdf` };
  }

  // PNG set: every slide must exist, so a partial render counts as not rendered.
  const slides: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < deck.slides.length; i += 1) {
    const rel = path.posix.join(rendersRel, slideName(i));
    if (!(await fileExists(rel))) throw new ExportError("not_rendered", NOT_RENDERED);
    slides.push({ name: slideName(i), data: await fs.readFile(resolveContentPath(rel)) });
  }

  // alt.txt is written by the renderer when it exists. Otherwise a plain list is built from the slide titles.
  const altRel = path.posix.join(rendersRel, "alt.txt");
  const alt = (await fileExists(altRel))
    ? await fs.readFile(resolveContentPath(altRel))
    : Buffer.from(deck.slides.map((s, i) => `Slide ${i + 1}: ${s.title}`).join("\n") + "\n", "utf8");

  const body = await zipBuffer([...slides, { name: "alt.txt", data: alt }]);
  return { body, contentType: "application/zip", filename: `${stem}-png.zip` };
}
