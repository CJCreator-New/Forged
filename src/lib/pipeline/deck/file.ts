import { promises as fs } from "node:fs";
import path from "node:path";
import { DeckSchema, type Deck } from "../../schemas/deck";
import { resolveContentPath } from "../../store/paths";
import { DeckExtrasSchema, type DeckExtras } from "./extras";
import { isNotFound, issuesText, RouteError } from "./http";

// Reads and writes the deck JSON file (content/weeks/<week>/days/<date>/<channel>-deck.json).
// The file is user data: writes refuse to replace an existing file unless replace is set.

export async function readDeckFile(deckRel: string): Promise<{ deck: Deck; extras: DeckExtras }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(resolveContentPath(deckRel), "utf8"));
  } catch (err) {
    if (isNotFound(err)) throw new RouteError(404, "deck_not_found", "No deck file exists at that path.");
    throw new RouteError(422, "deck_invalid", "The deck file is not valid JSON.");
  }
  const deck = DeckSchema.safeParse(raw);
  if (!deck.success) throw new RouteError(422, "deck_invalid", issuesText(deck.error.issues));
  const extras = DeckExtrasSchema.safeParse(raw);
  if (!extras.success) throw new RouteError(422, "deck_invalid", issuesText(extras.error.issues));
  return { deck: deck.data, extras: extras.data };
}

export async function deckFileExists(deckRel: string): Promise<boolean> {
  try {
    await fs.access(resolveContentPath(deckRel));
    return true;
  } catch {
    return false;
  }
}

export async function writeDeckFile(
  deckRel: string,
  deck: Deck,
  extras: DeckExtras,
  replace: boolean,
): Promise<void> {
  const file = resolveContentPath(deckRel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const text = JSON.stringify({ ...deck, ...extras }, null, 2) + "\n";
  try {
    await fs.writeFile(file, text, { encoding: "utf8", flag: replace ? "w" : "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new RouteError(409, "deck_exists", "A deck already exists here. Send replace: true to overwrite it.");
    }
    throw err;
  }
}
