/** Parte un texto para destacar lo buscado, sin distinguir mayúsculas ni tildes (igual que la búsqueda en la base). */
export type TextPart = { text: string; match: boolean };

function fold(text: string): string {
  // Carácter por carácter: así las posiciones coinciden con las del texto original.
  return Array.from(text, (ch) => {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return base.length === 1 ? base : ch;
  }).join("");
}

export function highlightParts(text: string, term: string | undefined): TextPart[] {
  const needle = term ? fold(term.trim()) : "";
  if (!needle) return [{ text, match: false }];
  const haystack = fold(text);
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
