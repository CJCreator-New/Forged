import DeckEditor from "../../components/deck/DeckEditor";

// Deck look editor. Opens one deck from ?path=, for example /deck?path=weeks/.../linkedin-deck.json
export default async function DeckPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.path;
  const path = Array.isArray(raw) ? raw[0] : raw;
  return <DeckEditor deckPath={path ?? ""} />;
}
