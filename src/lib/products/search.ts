/**
 * Ayudas de la búsqueda y el listado del panel de productos (sin React ni Supabase: se prueban con node --test).
 * La búsqueda de texto y de código de barras la resuelve la base (columna search_text y barcode); acá solo se sugiere
 * la categoría que coincide con lo escrito y se resume el stock de cada producto.
 */

/** Minúsculas y sin tildes: igual que la columna search_text de la base. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type CategoryHit = { id: string; label: string };

/**
 * Categorías cuyo nombre contiene lo escrito (desde 2 letras). Sirve para ofrecer «filtrar por esta categoría» como
 * resultado rápido. No suma nada si lo escrito es solo un número (código de barras).
 */
export function matchCategories(term: string, categories: CategoryHit[], max = 3): CategoryHit[] {
  const needle = fold(term);
  if (needle.length < 2 || /^[0-9]+$/.test(needle)) return [];
  return categories.filter((c) => fold(c.label).includes(needle)).slice(0, max);
}

/** Qué se está buscando, para describirlo en pantalla: código de barras (solo dígitos) o texto. */
export function searchKind(term: string): "vacio" | "codigo" | "texto" {
  const t = term.trim();
  if (!t) return "vacio";
  return /^[0-9]+$/.test(t) ? "codigo" : "texto";
}

export type StockLevel = "ok" | "bajo" | "sin";
export type StockSummary = { total: number; level: StockLevel; variants: number };

/**
 * Resumen del stock de un producto a partir de las unidades de cada variante. null si no tiene variantes (no hay nada
 * que contar: no se muestra «0»). «Sin stock» = todas en cero; «Bajo» = alguna variante con el umbral o menos.
 */
export function stockSummary(stocks: number[], threshold = 5): StockSummary | null {
  if (stocks.length === 0) return null;
  const clean = stocks.map((n) => (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const level: StockLevel = total === 0 ? "sin" : clean.some((n) => n <= threshold) ? "bajo" : "ok";
  return { total, level, variants: stocks.length };
}
