// Pruebas del panel (Etapa 1, fase 5): búsqueda de productos y dashboard. Ejecutar: node --test scripts/panel-fase5.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fold, matchCategories, searchKind, stockSummary } from "../src/lib/products/search.ts";

const root = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("búsqueda de productos", () => {
  const cats = [
    { id: "1", label: "Cocina" },
    { id: "2", label: "Limpieza › Baldes y tachos" },
    { id: "3", label: "Regalería" },
  ];

  it("normaliza tildes y mayúsculas como la base", () => {
    assert.equal(fold("  REGALERÍA "), "regaleria");
  });

  it("sugiere la categoría que coincide con lo escrito (sin tildes y a mitad de nombre)", () => {
    assert.deepEqual(matchCategories("regaleria", cats).map((c) => c.id), ["3"]);
    assert.deepEqual(matchCategories("BALDES", cats).map((c) => c.id), ["2"]);
    assert.deepEqual(matchCategories("co", cats).map((c) => c.id), ["1"]);
  });

  it("no sugiere con una letra, con números (código de barras) ni cuando no hay coincidencia", () => {
    assert.deepEqual(matchCategories("c", cats), []);
    assert.deepEqual(matchCategories("7791234567890", cats), []);
    assert.deepEqual(matchCategories("zzz", cats), []);
    assert.deepEqual(matchCategories("", cats), []);
  });

  it("respeta el máximo de sugerencias", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: String(i), label: `Plástico ${i}` }));
    assert.equal(matchCategories("plastico", many).length, 3);
    assert.equal(matchCategories("plastico", many, 5).length, 5);
  });

  it("distingue código de barras, texto y vacío", () => {
    assert.equal(searchKind("7791234567890"), "codigo");
    assert.equal(searchKind(" 779 "), "codigo");
    assert.equal(searchKind("779 abc"), "texto");
    assert.equal(searchKind("balde 10"), "texto");
    assert.equal(searchKind("   "), "vacio");
  });
});

describe("resumen de stock del listado", () => {
  it("suma las variantes y marca bajo o sin stock", () => {
    assert.deepEqual(stockSummary([10, 20]), { total: 30, level: "ok", variants: 2 });
    assert.deepEqual(stockSummary([10, 5]), { total: 15, level: "bajo", variants: 2 });
    assert.deepEqual(stockSummary([0, 0]), { total: 0, level: "sin", variants: 2 });
    assert.deepEqual(stockSummary([3]), { total: 3, level: "bajo", variants: 1 });
  });
  it("un producto sin variantes no tiene stock que mostrar (null, no «0»)", () => {
    assert.equal(stockSummary([]), null);
  });
  it("ignora valores inválidos o negativos", () => {
    assert.equal(stockSummary([Number.NaN, -3, 7])?.total, 7);
  });
  it("el umbral es configurable", () => {
    assert.equal(stockSummary([8], 10)?.level, "bajo");
    assert.equal(stockSummary([8], 5)?.level, "ok");
  });
});

describe("estructura del panel", () => {
  const products = read("src", "components", "panel", "sections", "products-section.tsx");
  const search = read("src", "components", "panel", "expanding-search.tsx");
  const home = read("src", "components", "panel", "sections", "home-section.tsx");
  const parts = read("src", "components", "panel", "sections", "dashboard-parts.tsx");
  const dashboard = read("src", "lib", "pos", "dashboard.ts");

  it("el buscador de productos se despliega, enfoca solo, se cierra con Escape y tiene limpiar y estado anunciado", () => {
    assert.ok(search.includes("input.current?.focus()") && search.includes('"Escape"') && search.includes("Limpiar") && search.includes('aria-live="polite"'));
    assert.ok(search.includes("motion-safe:transition-[width,opacity]"), "la animación respeta reducir movimiento");
    assert.ok(products.includes("<ExpandingSearch") && products.includes("matchCategories("));
  });

  it("el listado de productos muestra el stock solo a quien administra (la base lo oculta al público)", () => {
    assert.ok(products.includes("stockSummary(") && read("src", "lib", "products", "admin.ts").includes("product_variants(price,stock)"));
  });

  it("el dashboard lee los medios de pago y el contador mensual de la base, sin calcular nada a mano sobre datos inventados", () => {
    assert.ok(dashboard.includes('"sales_by_payment_method"') && dashboard.includes('"sales_monthly_by_payment_method"'));
    for (const src of [home, parts, dashboard]) assert.doesNotMatch(code(src), /Math\.random|faker|mock|demo/i);
  });

  it("cada indicador trae su definición y el ticket promedio sin ventas se muestra como «—»", () => {
    assert.ok(home.includes("Facturación dividida por ventas") && home.includes('ticket === null ? "—"'));
    for (const text of ["Cantidad de ventas confirmadas", "Suma del total de esas ventas", "Suma de las cantidades vendidas"]) assert.ok(home.includes(text), text);
  });

  it("no se muestran porcentajes ni comparaciones sin datos suficientes", () => {
    assert.ok(parts.includes('m.share === null ? "—"') && parts.includes("no se muestra ninguna comparación"));
    assert.ok(home.includes("compareMonths("));
  });

  it("la actividad reciente aclara que no hay anulaciones ni devoluciones (el modelo no las tiene) y abre el comprobante", () => {
    assert.ok(code(parts).includes("todavía no hay anulaciones ni devoluciones") && parts.includes("Ver comprobante") && home.includes("<ReceiptDialog"));
  });

  it("el panel sigue en tema claro: ningún componente nuevo usa tokens que cambian con el tema oscuro del catálogo", () => {
    for (const src of [parts, search]) assert.doesNotMatch(src, /bg-surface|bg-brand-card|text-on-ink|dark:/);
  });
});
