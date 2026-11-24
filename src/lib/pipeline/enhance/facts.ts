// Fact check for Enhance (CONTEXT.md, ADR 0007). Every number and every capitalised word or
// two-word name in the current body must still appear in the rewrite. Pure function, no I/O.

export type Facts = {
  numbers: string[];
  names: string[];
};

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const LETTER_AFTER = "(?![\\p{L}\\p{N}])";
const CAP_WORD = "\\p{Lu}[\\p{L}\\p{N}'’-]*";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Numbers as written, with thousands commas removed so "1,000" and "1000" compare equal.
function numbersIn(text: string): string[] {
  const found = text.match(NUMBER) ?? [];
  return found.map((n) => n.replace(/,/g, ""));
}

// True when the word at this index opens a sentence. Such a word is capitalised only by grammar,
// so it is not treated as a name (decision: sentence-opening words are ignored).
function opensSentence(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && (text[i] === " " || text[i] === "\t")) i -= 1;
  if (i < 0) return true;
  return text[i] === "\n" || text[i] === "." || text[i] === "!" || text[i] === "?" || text[i] === '"';
}

// Capitalised words and two-word names (two capitalised words in a row), as written.
// A single word that opens a sentence is skipped, unless it is part of a two-word name.
// Two-word names always count: two capitalised words in a row are almost always a name.
function namesIn(text: string): string[] {
  const names = new Set<string>();
  const pairs: string[] = [];
  const pairStarts = new Set<number>();
  for (const m of text.matchAll(new RegExp(`${LETTER_BEFORE}${CAP_WORD}[ \\t]+${CAP_WORD}`, "gu"))) {
    if (m.index === undefined) continue;
    pairStarts.add(m.index);
    pairs.push(m[0].replace(/[ \t]+/g, " "));
  }
  for (const m of text.matchAll(new RegExp(`${LETTER_BEFORE}${CAP_WORD}`, "gu"))) {
    if (m.index === undefined) continue;
    if (!opensSentence(text, m.index) || pairStarts.has(m.index)) names.add(m[0]);
  }
  for (const pair of pairs) names.add(pair);
  return [...names];
}

export function extractFacts(body: string): Facts {
  return {
    numbers: [...new Set(numbersIn(body))],
    names: namesIn(body),
  };
}

function containsWhole(text: string, phrase: string): boolean {
  return new RegExp(`${LETTER_BEFORE}${escapeRegExp(phrase)}${LETTER_AFTER}`, "u").test(text);
}

// Returns each fact from the current body that the rewrite no longer contains. Empty means all kept.
export function missingFacts(currentBody: string, rewrite: string): string[] {
  const facts = extractFacts(currentBody);
  const rewriteNumbers = new Set(numbersIn(rewrite));
  const missing: string[] = [];
  for (const n of facts.numbers) {
    if (!rewriteNumbers.has(n)) missing.push(n);
  }
  const rewriteSpaced = rewrite.replace(/[ \t]+/g, " ");
  for (const name of facts.names) {
    if (!containsWhole(rewriteSpaced, name)) missing.push(name);
  }
  return missing;
}
