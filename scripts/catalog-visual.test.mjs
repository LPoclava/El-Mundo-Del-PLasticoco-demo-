// Pruebas del rediseño visual del catálogo (Etapa 1, fase 4). Ejecutar: node --test scripts/catalog-visual.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stageRatio, MIN_RATIO, MAX_RATIO } from "../src/lib/catalog/gallery.ts";

const root = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

describe("galería adaptable", () => {
  it("la forma del escenario sigue a la foto: vertical, apaisada o cuadrada", () => {
    assert.equal(stageRatio(800, 800), 1);
    assert.ok(stageRatio(640, 960) < 1, "foto vertical, escenario vertical");
    assert.ok(stageRatio(1200, 700) > 1, "foto apaisada, escenario apaisado");
  });

  it("está acotada para que ni una foto muy alargada ni una muy chata rompan la página", () => {
    assert.equal(stageRatio(100, 1000), MIN_RATIO);
    assert.equal(stageRatio(3000, 300), MAX_RATIO);
    assert.ok(stageRatio(1000, 1250) >= MIN_RATIO && stageRatio(1400, 1000) <= MAX_RATIO);
  });

  it("datos inválidos dan un escenario cuadrado (sin NaN en el estilo)", () => {
    for (const [w, h] of [[0, 10], [10, 0], [NaN, 10], [10, Infinity], [-5, 5]]) assert.equal(stageRatio(w, h), 1);
  });

  it("se redondea para que diferencias mínimas no muevan el contenido", () => {
    assert.equal(stageRatio(1001, 1000), stageRatio(1000, 1000));
  });
});

describe("ficha, ventana y tarjetas comparten composición y carrito", () => {
  const card = read("src", "components", "catalog", "product-card.tsx");
  const purchase = read("src", "components", "product", "product-purchase.tsx");
  const quick = read("src", "components", "product", "product-quick-view.tsx");
  const page = read("src", "app", "(site)", "producto", "[slug]", "page.tsx");
  const gallery = read("src", "components", "product", "product-gallery.tsx");

  it("las tres superficies agregan al pedido y consultan por WhatsApp", () => {
    assert.ok(card.includes("<AddToCartButton") && card.includes("productInquiryHref("));
    assert.ok(purchase.includes("add(") && purchase.includes("Agregar al pedido") && purchase.includes("productInquiryHref("));
    assert.ok(quick.includes("<ProductPurchase") && page.includes("<ProductPurchase"), "la ventana y la página usan el mismo bloque de compra");
  });

  it("la ventana y la página usan la misma galería y las mismas características", () => {
    for (const src of [quick, page]) assert.ok(src.includes("<ProductGallery") && src.includes("<FeatureTiles"));
  });

  it("no se muestra stock ni disponibilidad inventada en el catálogo público", () => {
    // Se revisa el código, no los comentarios (que sí pueden explicar por qué no se muestra).
    const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const src of [card, purchase, quick, page, gallery, read("src", "components", "catalog", "discovery-section.tsx")]) {
      assert.doesNotMatch(code(src), /\bstock\b|en stock|disponibilidad:|últimas unidades|agotado/i);
    }
  });

  it("las características salen solo de los datos cargados (sin materiales ni dimensiones supuestas)", () => {
    const features = read("src", "lib", "catalog", "features.ts");
    assert.doesNotMatch(features, /material|dimension|peso|capacidad/i);
    const tiles = read("src", "components", "product", "feature-tiles.tsx");
    assert.doesNotMatch(tiles, /Material|Peso|Capacidad/);
  });

  it("la tarjeta no recorta la foto (contain), usa botones táctiles de 44 px y no inventa datos", () => {
    assert.ok(card.includes("object-contain"));
    assert.ok(card.includes("h-11") && card.includes("min-[24rem]:w-11") && purchase.includes("size-11"));
    assert.ok(read("src", "components", "cart", "add-to-cart-button.tsx").includes("min-h-11"));
    assert.doesNotMatch(card, /Nuevo|Oferta|Descuento|% ?off/i);
  });

  it("las variantes se eligen con botones de opción accesibles (radio, leyenda y aviso)", () => {
    assert.ok(purchase.includes('type="radio"') && purchase.includes("<legend") && purchase.includes('role="alert"'));
  });

  it("la galería no agranda fotos más allá de su resolución real y muestra svg sin optimizar como el resto del sitio", () => {
    assert.ok(gallery.includes("naturalWidth") && gallery.includes("maxWidth") && gallery.includes("unoptimized"));
  });
});

describe("sección de descubrimiento", () => {
  const section = read("src", "components", "catalog", "discovery-section.tsx");
  const front = read("src", "components", "catalog", "home-front.tsx");
  const repo = read("src", "lib", "catalog", "repository.ts");
  const copy = read("src", "config", "catalog-copy.ts");

  it("conserva el concepto y no usa el título genérico", () => {
    assert.ok(read("src", "config", "catalog-copy.ts").includes("en un mismo lugar"));
    assert.ok(section.includes("discovery.text") && copy.includes("todo lo que necesitás en un mismo lugar"));
    assert.doesNotMatch(section + copy, /Descubrí nuestra variedad/);
  });

  it("sale del catálogo real: sin productos no se muestra y las promociones solo aparecen si hay banners", () => {
    assert.ok(section.includes("if (groups.length === 0) return null"));
    assert.ok(section.includes("banners.length > 0"));
    assert.ok(repo.includes("groups.filter((g) => g.products.length > 0)"));
  });

  it("no aparece con una búsqueda o un filtro activo y está en la portada", () => {
    assert.ok(section.includes("if (q || category) return null"));
    assert.ok(front.includes("<DiscoverySection"));
  });

  it("el carril es accesible: región con nombre, foco para teclado y tarjetas reales con carrito", () => {
    assert.ok(section.includes('role="region"') && section.includes("aria-labelledby") && section.includes("tabIndex={0}"));
    assert.ok(section.includes("<ProductCard"));
  });

  it("respeta reducir movimiento en las animaciones nuevas", () => {
    const css = read("src", "app", "globals.css");
    assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*\.added-pop, \.cart-line-in, \.qty-pop/);
    assert.match(css, /prefers-reduced-motion: no-preference\)[\s\S]*\.product-card \.card-photo/);
  });
});

describe("servidor ficticio de pruebas visuales", () => {
  const mock = read("supabase", "dev", "mock-public-api.mjs");

  it("existe, es solo de lectura y no se conecta a ningún servicio externo", () => {
    assert.ok(existsSync(join(root, "supabase", "dev", "mock-public-api.mjs")));
    assert.ok(mock.includes('req.method !== "GET"'));
    assert.doesNotMatch(mock, /supabase\.co|service_role|process\.env\.(?!MOCK_)/);
  });

  it("cubre las cinco vistas públicas y variedad de proporciones, variantes y datos faltantes", () => {
    for (const v of ["public_catalog", "public_categories", "public_promo_banners", "public_product_images", "public_product_variants"]) assert.ok(mock.includes(v));
    assert.ok(mock.includes("vertical-") && mock.includes("apaisada-") && mock.includes("cuadrada-"));
  });
});
