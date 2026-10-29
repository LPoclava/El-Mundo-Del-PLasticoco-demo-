// Pruebas de las reglas de productos del panel. Ejecutar: node --test scripts/product-rules.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrice, validateProductForm, hasErrors, publishBlockers, hiddenReasons, pricesOf, ensureSinglePrimary,
  moveItem, removedIds, orphanedPaths, storagePathFor, normalizeSearch, escapeLike,
} from "../src/lib/products/rules.ts";
import { validateProductImageSize } from "../src/lib/banners/rules.ts";

const variant = (over = {}) => ({ key: "k1", id: null, size: "", color: "", price: "1500", ...over });
const form = (over = {}) => ({
  name: "Balde", brand: "", description: "", categoryId: "cat", barcode: "", sku: "", variants: [variant()], imageCount: 1, ...over,
});

describe("precios", () => {
  it("acepta enteros positivos y vacío (sin precio)", () => {
    assert.deepEqual(parsePrice("1500"), { ok: true, value: 1500 });
    assert.deepEqual(parsePrice(" 20 "), { ok: true, value: 20 });
    assert.deepEqual(parsePrice(""), { ok: true, value: null });
  });
  it("rechaza centavos, cero, negativos, texto y valores enormes", () => {
    for (const bad of ["12,5", "12.5", "0", "-3", "abc", "1e3", "1000000000", "99999999999999999999"]) {
      assert.equal(parsePrice(bad).ok, false, bad);
    }
  });
});

describe("formulario", () => {
  it("un producto completo es válido", () => {
    assert.equal(hasErrors(validateProductForm(form())), false);
  });
  it("exige nombre y categoría", () => {
    const e = validateProductForm(form({ name: "  ", categoryId: "" }));
    assert.ok(e.name && e.categoryId);
  });
  it("valida código de barras y largos", () => {
    assert.ok(validateProductForm(form({ barcode: "123" })).barcode);
    assert.ok(validateProductForm(form({ barcode: "abc12345678" })).barcode);
    assert.equal(validateProductForm(form({ barcode: "7791234567890" })).barcode, undefined);
    assert.ok(validateProductForm(form({ name: "x".repeat(201) })).name);
    assert.ok(validateProductForm(form({ description: "x".repeat(2001) })).description);
  });
  it("valida el precio de cada variante y detecta variantes repetidas", () => {
    const e = validateProductForm(form({ variants: [variant({ key: "a", price: "12,5" }), variant({ key: "b", size: "G" }), variant({ key: "c", size: " g " })] }));
    assert.ok(e.variants.a.price);
    assert.equal(e.variants.b, undefined);
    assert.ok(e.variants.c.duplicate);
  });
  it("no admite más de 5 fotos", () => {
    assert.ok(validateProductForm(form({ imageCount: 6 })).images);
    assert.equal(validateProductForm(form({ imageCount: 5 })).images, undefined);
  });
});

describe("publicación", () => {
  it("sin foto principal o sin precio válido no se puede publicar", () => {
    assert.deepEqual(publishBlockers({ hasPrimaryImage: true, prices: [100] }), []);
    assert.equal(publishBlockers({ hasPrimaryImage: false, prices: [100] }).length, 1);
    assert.equal(publishBlockers({ hasPrimaryImage: true, prices: [null] }).length, 1);
    assert.equal(publishBlockers({ hasPrimaryImage: true, prices: [] }).length, 1);
    assert.equal(publishBlockers({ hasPrimaryImage: false, prices: [] }).length, 2);
  });
  it("explica por qué un producto no se ve en el catálogo", () => {
    const base = { publishEnabled: true, archivedAt: null, hasPrimaryImage: true, prices: [100] };
    assert.deepEqual(hiddenReasons(base), []);
    assert.deepEqual(hiddenReasons({ ...base, publishEnabled: false }), ["Sin publicar"]);
    assert.ok(hiddenReasons({ ...base, archivedAt: "2026-10-01T00:00:00Z" }).includes("Archivado"));
    assert.ok(hiddenReasons({ ...base, hasPrimaryImage: false }).some((r) => /foto principal/.test(r)));
    assert.ok(hiddenReasons({ ...base, prices: [null, 0] }).some((r) => /precio/.test(r)));
  });
  it("interpreta los precios del formulario", () => {
    assert.deepEqual(pricesOf([variant({ price: "10" }), variant({ price: "" }), variant({ price: "x" })]), [10, null, null]);
  });
});

describe("fotos", () => {
  it("siempre queda exactamente una principal", () => {
    assert.deepEqual(ensureSinglePrimary([]), []);
    const none = ensureSinglePrimary([{ isPrimary: false }, { isPrimary: false }]);
    assert.deepEqual(none.map((i) => i.isPrimary), [true, false]);
    const two = ensureSinglePrimary([{ isPrimary: true }, { isPrimary: true }, { isPrimary: false }]);
    assert.deepEqual(two.map((i) => i.isPrimary), [true, false, false]);
    const second = ensureSinglePrimary([{ isPrimary: false }, { isPrimary: true }]);
    assert.deepEqual(second.map((i) => i.isPrimary), [false, true]);
  });
  it("reordena sin mutar y respeta los límites", () => {
    const list = ["a", "b", "c"];
    assert.deepEqual(moveItem(list, 0, 1), ["b", "a", "c"]);
    assert.deepEqual(moveItem(list, 2, 1), ["a", "c", "b"]);
    assert.deepEqual(moveItem(list, 0, -1), list);
    assert.deepEqual(moveItem(list, 2, 3), list);
    assert.deepEqual(list, ["a", "b", "c"]);
  });
  it("calcula qué filas se borran y qué archivos quedan sin uso", () => {
    assert.deepEqual(removedIds(["1", "2", "3"], ["1", null, "3"]), ["2"]);
    assert.deepEqual(removedIds([], ["x"]), []);
    assert.deepEqual(orphanedPaths(["p/a", "p/b", "p/a"], ["p/b"]), ["p/a"]);
    assert.deepEqual(orphanedPaths(["p/a"], []), ["p/a"]);
  });
  it("usa la convención de rutas del bucket", () => {
    assert.equal(storagePathFor("abc", "webp", "u-1"), "products/abc/u-1.webp");
  });
  it("valida tamaño y proporción de la foto", () => {
    assert.equal(validateProductImageSize(1000, 1000), null);
    assert.equal(validateProductImageSize(1200, 900), null);
    assert.match(validateProductImageSize(300, 300), /muy chica/);
    assert.match(validateProductImageSize(1600, 500), /proporción/);
    assert.match(validateProductImageSize(500, 1200), /proporción/);
    assert.match(validateProductImageSize(0, 0), /tamaño/);
  });
});

describe("búsqueda", () => {
  it("normaliza como products.search_text y escapa comodines", () => {
    assert.equal(normalizeSearch("  ÑANDÚ  Grande "), "nandu  grande");
    assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b");
  });
});
