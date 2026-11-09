// Servidor LOCAL de datos ficticios para probar el catálogo público sin tocar producción.
// Imita lo mínimo de PostgREST (Supabase) para las vistas públicas que lee el sitio y sirve fotos PNG generadas.
//
//   node supabase/dev/mock-public-api.mjs            (puerto 54321)
//   $env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="mock"; npm run dev
//
// Todo es inventado y vive solo en memoria: no se conecta a Supabase ni escribe nada en ningún lado.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 54321);

// ---------------------------------------------------------------- imágenes SVG generadas (sin dependencias)
// SVG y no PNG a propósito: el sitio ya muestra los .svg sin optimizar, así no hay que tocar la configuración de imágenes de Next.
const esc = (s) => s.replace(/[<>&"]/g, "");
/** «Foto» de producto: fondo claro y un objeto de color (taza, caja, botella o elipse) con brillo y sombra. */
function productPhoto(w, h, [r, g, b], shape = "ellipse") {
  const base = `rgb(${r},${g},${b})`;
  const dark = `rgb(${Math.round(r * 0.72)},${Math.round(g * 0.72)},${Math.round(b * 0.72)})`;
  const cx = w / 2, cy = h / 2;
  const bw = w * 0.52, bh = h * 0.58;
  let body;
  if (shape === "box") body = `<rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${Math.min(bw, bh) * 0.1}" fill="url(#g)"/><rect x="${cx - bw / 2}" y="${cy - bh * 0.12}" width="${bw}" height="${bh * 0.2}" fill="#fff" opacity="0.85"/>`;
  else if (shape === "bottle") body = `<rect x="${cx - bw * 0.22}" y="${cy - bh / 2}" width="${bw * 0.44}" height="${bh * 0.16}" rx="6" fill="${dark}"/><rect x="${cx - bw * 0.36}" y="${cy - bh * 0.36}" width="${bw * 0.72}" height="${bh * 0.86}" rx="${bw * 0.16}" fill="url(#g)"/>`;
  else body = `<ellipse cx="${cx}" cy="${cy}" rx="${bw / 2}" ry="${bh / 2}" fill="url(#g)"/><ellipse cx="${cx}" cy="${cy}" rx="${bw / 2}" ry="${bh * 0.07}" fill="#fff" opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="#f3f1ec"/><ellipse cx="${cx}" cy="${cy + bh / 2 + h * 0.02}" rx="${bw * 0.5}" ry="${h * 0.02}" fill="#000" opacity="0.12"/>${body}</svg>`;
}
void esc;

const PHOTOS = {
  "demo/cuadrada-azul.svg": () => productPhoto(800, 800, [52, 110, 190], "bottle"),
  "demo/cuadrada-roja.svg": () => productPhoto(800, 800, [196, 70, 60], "box"),
  "demo/apaisada-verde.svg": () => productPhoto(1200, 700, [57, 131, 74], "box"),
  "demo/apaisada-naranja.svg": () => productPhoto(1100, 700, [232, 139, 74]),
  "demo/vertical-violeta.svg": () => productPhoto(640, 960, [120, 80, 170], "bottle"),
  "demo/vertical-gris.svg": () => productPhoto(600, 900, [110, 120, 130], "box"),
  "demo/chica-amarilla.svg": () => productPhoto(360, 360, [226, 190, 60]),
  "demo/banner.svg": () => productPhoto(1600, 640, [232, 139, 74], "box"),
  "demo/categoria.svg": () => productPhoto(600, 400, [57, 131, 74]),
};
const photoCache = new Map();

// ---------------------------------------------------------------- datos ficticios
const CATEGORIES = [
  { slug: "cocina", name: "Cocina", parent_slug: null, featured_position: 1, image_path: "demo/categoria.svg", description: "Para cocinar, guardar y servir." },
  { slug: "limpieza", name: "Limpieza", parent_slug: null, featured_position: 2, image_path: null, description: null },
  { slug: "regaleria", name: "Regalería", parent_slug: null, featured_position: 3, image_path: null, description: null },
  { slug: "libreria", name: "Librería", parent_slug: null, featured_position: 4, image_path: null, description: null },
  { slug: "baldes", name: "Baldes y tachos", parent_slug: "limpieza", featured_position: null, image_path: null, description: null },
];

const A = "demo/cuadrada-azul.svg", R = "demo/cuadrada-roja.svg", G = "demo/apaisada-verde.svg", O = "demo/apaisada-naranja.svg";
const V = "demo/vertical-violeta.svg", GR = "demo/vertical-gris.svg", Y = "demo/chica-amarilla.svg";

// [id, nombre, marca, categoría, descripción, fotos, variantes[size,color,precio]]
const SEED = [
  ["a1", "Vaso térmico de acero 500 ml", "Termolar", "cocina", "Vaso con tapa a rosca y doble pared. Mantiene la temperatura de bebidas frías y calientes.", [A, V, G], [[null, "Negro", 8900], [null, "Azul", 8900], [null, "Rojo", 9200]]],
  ["a2", "Set de 3 fuentes rectangulares", null, "cocina", "Fuentes de distintos tamaños, aptas para freezer.", [G], [[ "3 piezas", null, 12500]]],
  ["a3", "Bandeja organizadora de cubiertos con un nombre muy largo para probar el corte de texto en tarjetas", "Rigolleau", "cocina", null, [O], [[null, null, 4300]]],
  ["a4", "Botella deportiva", "Aquafit", "cocina", "Botella liviana con pico antiderrame.", [V, A], [["500 ml", null, 3500], ["750 ml", null, 4200], ["1 L", null, 5100]]],
  ["a5", "Frasco hermético redondo", null, "cocina", "Cierre hermético con tapa a presión.", [Y], []],
  ["b1", "Balde reforzado 10 L", "Plastiforte", "baldes", "Balde con manija de acero y borde reforzado.", [R, GR], [["10 L", "Rojo", 5200], ["10 L", "Azul", 5200]]],
  ["b2", "Tacho con tapa vaivén 30 L", null, "baldes", null, [GR], [[null, null, 14900]]],
  ["b3", "Escurridor de platos", "Marplast", "limpieza", "Escurridor con bandeja recolectora.", [G, O], [[null, null, 9800]]],
  ["c1", "Caja organizadora con tapa", null, "limpieza", "Apilable, con tapa y manijas laterales.", [A], [["Chica", null, 3900], ["Mediana", null, 6100], ["Grande", null, 9400]]],
  ["d1", "Alcancía clásica", null, "regaleria", "Ideal para regalar.", [Y, R], [[null, null, 2600]]],
  ["d2", "Portarretrato 10x15", "Decor", "regaleria", null, [R], [[null, "Blanco", 2200], [null, "Negro", 2200]]],
  ["e1", "Set de reglas escolares", "Escolar", "libreria", "Regla, escuadra y transportador.", [A], [[null, null, 1800]]],
  ["e2", "Carpeta de tres solapas", null, "libreria", null, [GR], [[null, null, 2100]]],
  ["e3", "Lapicera de gel", null, "libreria", null, [V], [[null, "Negro", 900], [null, "Azul", 900]]],
];

const products = SEED.map(([, name, brand, category_slug, description, photos, variants], index) => {
  // El sitio exige identificadores UUID en las direcciones de producto.
  const id = `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`;
  const prices = variants.map((v) => v[2]);
  const price = prices.length ? Math.min(...prices) : 4500; // una variante sin precio cargado no se publica; se usa un precio general ficticio
  const parent = CATEGORIES.find((c) => c.slug === category_slug)?.parent_slug ?? null;
  return {
    id, name, brand, category_slug, main_category_slug: parent ?? category_slug, description,
    image_path: photos[0], price, has_price_range: new Set(prices).size > 1,
    name_sort: name.toLowerCase(), search_text: `${name} ${brand ?? ""} ${description ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    photos, variants,
  };
});

const BANNERS = process.env.MOCK_BANNERS === "0" ? [] : [
  { id: "b-1", title: "Combos para el hogar", body: "Armamos combos a medida: consultanos.", badge: "Promo", cta_label: "Ver catálogo", link_url: "/#catalogo", image_path: "demo/banner.svg", image_mobile_path: null, image_alt: "Combos para el hogar", position: 0 },
];

// ---------------------------------------------------------------- PostgREST mínimo
const view = {
  public_categories: () => CATEGORIES,
  public_promo_banners: () => BANNERS,
  public_catalog: () => products,
  public_product_images: () => products.flatMap((p) => p.photos.map((path, i) => ({ product_id: p.id, path, is_primary: i === 0, position: i }))),
  public_product_variants: () => products.flatMap((p) => p.variants.map(([size, color, price], i) => ({ id: `11111111-0000-4000-8000-${(products.indexOf(p) * 16 + i + 1).toString(16).padStart(12, "0")}`, product_id: p.id, size, color, price, position: i }))),
};

const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1);

function applyFilter(rows, key, value) {
  if (key === "or") {
    const parts = value.replace(/^\(|\)$/g, "").split(",").map((p) => p.split("."));
    return rows.filter((r) => parts.some(([col, op, ...rest]) => op === "eq" && String(r[col]) === rest.join(".")));
  }
  const m = /^(eq|neq|ilike|not\.is)\.(.*)$/.exec(value);
  if (!m) return rows;
  const [, op, arg] = m;
  if (op === "eq") return rows.filter((r) => String(r[key]) === arg);
  if (op === "neq") return rows.filter((r) => String(r[key]) !== arg);
  if (op === "ilike") {
    const needle = arg.replace(/^\*|\*$/g, "").replace(/\\([\\%_])/g, "$1").toLowerCase();
    return rows.filter((r) => String(r[key] ?? "").toLowerCase().includes(needle));
  }
  return rows;
}

function handleRest(req, res, url) {
  const name = url.pathname.replace("/rest/v1/", "");
  const source = view[name];
  if (!source) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ code: "PGRST205", message: `Could not find the table 'public.${name}'` }));
  }
  let rows = [...source()];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    rows = applyFilter(rows, key, value);
  }
  const orders = url.searchParams.getAll("order").flatMap((o) => o.split(","));
  rows.sort((a, b) => {
    for (const o of orders) {
      const [col, dir] = o.split(".");
      const c = cmp(a[col], b[col]);
      if (c) return dir === "desc" ? -c : c;
    }
    return 0;
  });
  const total = rows.length;
  let start = Number(url.searchParams.get("offset") ?? 0);
  let end = url.searchParams.has("limit") ? start + Number(url.searchParams.get("limit")) - 1 : total - 1;
  const range = /^(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
  if (range) [start, end] = [Number(range[1]), Number(range[2])];
  const page = rows.slice(start, end + 1);
  const select = url.searchParams.get("select") ?? "*";
  const cols = select === "*" ? null : select.split(",").map((c) => c.trim());
  const out = cols ? page.map((r) => Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]]))) : page;
  // Una columna pedida que no existe en la vista (por ejemplo, de una migración sin aplicar) se informa como lo haría PostgREST.
  if (cols) {
    const sample = source()[0] ?? {};
    const missing = cols.find((c) => !(c in sample) && !c.includes("("));
    if (missing) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ code: "42703", message: `column ${name}.${missing} does not exist` }));
    }
  }
  const headers = { "content-type": "application/json", "content-range": `${total === 0 ? "*" : `${start}-${Math.min(end, total - 1)}`}/${total}` };
  res.writeHead(200, headers);
  res.end(JSON.stringify(out));
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-expose-headers": "content-range",
};

createServer((req, res) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (req.method !== "GET") return res.writeHead(405).end();
  if (url.pathname.startsWith("/rest/v1/")) return handleRest(req, res, url);
  const m = /^\/storage\/v1\/object\/public\/product-images\/(.+)$/.exec(url.pathname);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const make = PHOTOS[key];
    if (!make) return res.writeHead(404).end();
    if (!photoCache.has(key)) photoCache.set(key, make());
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" });
    return res.end(photoCache.get(key));
  }
  res.writeHead(404).end();
}).listen(PORT, "127.0.0.1", () => console.log(`Servidor ficticio en http://127.0.0.1:${PORT} (${products.length} productos de ejemplo)`));
