// Pruebas de las reglas de la ficha de producto. Ejecutar: node --test scripts/product-detail.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  slugify, productSlug, productPath, parseProductSlug, variantLabel, needsSelection, distinctValues, inquiryText,
} from "../src/lib/catalog/product.ts";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("URL de la ficha", () => {
  it("es legible y lleva el id", () => {
    assert.equal(slugify("Balde 10 L — Baño & Cocina"), "balde-10-l-bano-cocina");
    assert.equal(productPath({ id: ID, name: "Táper Ñandú 2L" }), `/producto/taper-nandu-2l-${ID}`);
  });

  it("recorta nombres largos en una palabra completa", () => {
    const s = slugify("organizador ".repeat(10));
    assert.ok(s.length <= 60 && !s.endsWith("-"));
  });

  it("un nombre sin letras usa 'producto'", () => {
    assert.equal(productSlug({ id: ID, name: "!!!" }), `producto-${ID}`);
  });

  it("extrae el id aunque el nombre esté desactualizado o en mayúsculas", () => {
    assert.equal(parseProductSlug(`balde-viejo-${ID}`), ID);
    assert.equal(parseProductSlug(`OTRO-${ID.toUpperCase()}`), ID);
    assert.equal(parseProductSlug(ID), ID);
  });

  it("rechaza segmentos sin id válido", () => {
    for (const bad of ["balde", "balde-123", `${ID}-x`, "%E0%A4%A", `${"a".repeat(200)}-${ID}`]) {
      assert.equal(parseProductSlug(bad), null, bad);
    }
  });
});

describe("variantes", () => {
  it("arma la etiqueta con medida y color", () => {
    assert.equal(variantLabel({ size: "20L", color: "Rojo" }), "20L · Rojo");
    assert.equal(variantLabel({ size: null, color: "Azul" }), "Azul");
    assert.equal(variantLabel({ size: " ", color: null }), null);
  });

  it("pide elegir solo si hay más de una", () => {
    assert.equal(needsSelection([]), false);
    assert.equal(needsSelection([{}]), false);
    assert.equal(needsSelection([{}, {}]), true);
  });

  it("lista medidas y colores sin repetir", () => {
    const vs = [
      { size: "10L", color: "Rojo" },
      { size: "20L", color: "Rojo" },
      { size: "10L", color: null },
    ];
    assert.deepEqual(distinctValues(vs, "size"), ["10L", "20L"]);
    assert.deepEqual(distinctValues(vs, "color"), ["Rojo"]);
  });
});

describe("mensaje de WhatsApp", () => {
  it("incluye producto, variante, precio y enlace", () => {
    const text = inquiryText({ name: "Balde", variant: "20L · Rojo", price: "$ 1.800", url: `https://x.com/producto/balde-${ID}` });
    assert.match(text, /Balde \(20L · Rojo\)/);
    assert.match(text, /Precio publicado: \$ 1\.800\./);
    assert.match(text, new RegExp(`Link: https://x.com/producto/balde-${ID}`));
  });

  it("aclara 'desde' y omite lo que no hay", () => {
    const text = inquiryText({ name: "Vaso", price: "$ 500", fromPrice: true });
    assert.match(text, /desde \$ 500/);
    assert.doesNotMatch(text, /Link|\(/);
  });
});
