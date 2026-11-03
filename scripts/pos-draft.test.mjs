// Pruebas del borrador de venta y del texto del comprobante. Ejecutar: node --test scripts/pos-draft.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDraft } from "../src/lib/pos/draft.ts";
import { receiptText } from "../src/lib/pos/receipt.ts";

const line = (over = {}) => ({
  variantId: "v1", productId: "p1", name: "Balde", variantLabel: "10 L", barcode: "7790001000011", imagePath: null,
  unitPrice: 1500, quantity: 2, stock: 10, ...over,
});

describe("borrador de venta", () => {
  it("recupera un carrito válido", () => {
    const cart = [line(), line({ variantId: "v2", variantLabel: null })];
    assert.deepEqual(parseDraft(JSON.stringify(cart)), cart);
  });

  it("devuelve vacío si no hay nada o está dañado", () => {
    assert.deepEqual(parseDraft(null), []);
    assert.deepEqual(parseDraft(""), []);
    assert.deepEqual(parseDraft("{no es json"), []);
    assert.deepEqual(parseDraft('{"a":1}'), []);
  });

  it("descarta el borrador entero si una línea es inválida (sin carritos a medias)", () => {
    assert.deepEqual(parseDraft(JSON.stringify([line(), line({ variantId: "v2", quantity: 0 })])), []);
    assert.deepEqual(parseDraft(JSON.stringify([line({ unitPrice: -5 })])), []);
    assert.deepEqual(parseDraft(JSON.stringify([line({ variantId: "" })])), []);
    assert.deepEqual(parseDraft(JSON.stringify([line({ quantity: 1.5 })])), []);
  });

  it("rechaza dos líneas de la misma variante", () => {
    assert.deepEqual(parseDraft(JSON.stringify([line(), line()])), []);
  });
});

describe("texto del comprobante", () => {
  it("incluye número, productos, total y medio de pago", () => {
    const text = receiptText({
      number: 12, createdAt: "2026-10-30T15:00:00Z", userName: "Ana", paymentLabel: "Efectivo", total: 4000,
      items: [{ productName: "Balde", variantLabel: "10 L", quantity: 2, unitPrice: 1500, subtotal: 3000 }, { productName: "Vaso", variantLabel: null, quantity: 1, unitPrice: 1000, subtotal: 1000 }],
    });
    assert.match(text, /Comprobante de venta #12/);
    assert.match(text, /2 × Balde \(10 L\)/);
    assert.match(text, /1 × Vaso —/);
    assert.match(text, /Total: .*4\.000/);
    assert.match(text, /Medio de pago: Efectivo/);
    assert.match(text, /Atendió: Ana/);
  });
});
