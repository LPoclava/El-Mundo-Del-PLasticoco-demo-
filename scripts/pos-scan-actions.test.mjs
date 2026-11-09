// Pruebas de las acciones del escáner. Ejecutar: node --test scripts/pos-scan-actions.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  availableActions, autoAddVariant, productStatus, cancelNeedsConfirmation, stockHref, barcodeFromSearch,
} from "../src/lib/pos/scan-actions.ts";

const v = (over = {}) => ({ id: "v1", size: null, color: null, price: 1000, stock: 3, ...over });
const prod = (over = {}) => ({
  productId: "p1", name: "Balde", brand: null, description: null, barcode: "7791111000011", imagePath: null, archived: false,
  variants: [v()], ...over,
});
const found = (p) => ({ kind: "product", product: p });

describe("estado del producto", () => {
  it("disponible, sin stock, sin precio, incompleto y archivado", () => {
    assert.deepEqual(productStatus(prod()), { tone: "ok", label: "Disponible para vender" });
    assert.equal(productStatus(prod({ variants: [v({ stock: 0 })] })).label, "Sin stock");
    assert.equal(productStatus(prod({ variants: [v({ price: null })] })).label, "Sin precio cargado");
    assert.equal(productStatus(prod({ variants: [] })).label, "Producto incompleto");
    assert.equal(productStatus(prod({ archived: true })).tone, "danger");
  });
});

describe("acciones disponibles", () => {
  it("código desconocido: solo registrar producto; en modo venta, ninguna", () => {
    assert.deepEqual(availableActions({ kind: "unknown" }, { canManage: true, saleMode: false }), ["registrar-producto"]);
    assert.deepEqual(availableActions({ kind: "unknown" }, { canManage: false, saleMode: false }), ["registrar-producto"]);
    assert.deepEqual(availableActions({ kind: "unknown" }, { canManage: true, saleMode: true }), []);
  });

  it("producto completo: vender siempre; stock solo para gerente o superior", () => {
    assert.deepEqual(availableActions(found(prod()), { canManage: true, saleMode: false }), ["registrar-venta", "actualizar-stock"]);
    assert.deepEqual(availableActions(found(prod()), { canManage: false, saleMode: false }), ["registrar-venta"]);
  });

  it("sin stock no se ofrece vender pero sí actualizar stock", () => {
    const p = prod({ variants: [v({ stock: 0 })] });
    assert.deepEqual(availableActions(found(p), { canManage: true, saleMode: false }), ["actualizar-stock"]);
    assert.deepEqual(availableActions(found(p), { canManage: false, saleMode: false }), []);
  });

  it("incompleto: completar; archivado: ni vender ni mover stock", () => {
    assert.deepEqual(availableActions(found(prod({ variants: [] })), { canManage: true, saleMode: false }), ["completar-producto"]);
    assert.deepEqual(availableActions(found(prod({ archived: true })), { canManage: true, saleMode: false }), []);
  });

  it("modo venta oculta registrar y stock: solo agregar", () => {
    assert.deepEqual(availableActions(found(prod()), { canManage: true, saleMode: true }), ["agregar"]);
    assert.deepEqual(availableActions(found(prod({ variants: [] })), { canManage: true, saleMode: true }), []);
    assert.deepEqual(availableActions(found(prod({ archived: true })), { canManage: true, saleMode: true }), []);
  });
});

describe("agregado automático y cancelación", () => {
  it("una sola variante vendible se agrega sola; con varias o sin stock, no", () => {
    assert.equal(autoAddVariant(prod())?.id, "v1");
    assert.equal(autoAddVariant(prod({ variants: [v(), v({ id: "v2" })] })), null);
    assert.equal(autoAddVariant(prod({ variants: [v({ stock: 0 })] })), null);
    assert.equal(autoAddVariant(prod({ archived: true })), null);
  });

  it("cancelar pide confirmación solo si hay unidades", () => {
    assert.equal(cancelNeedsConfirmation(0), false);
    assert.equal(cancelNeedsConfirmation(2), true);
  });
});

describe("enlace al control de stock", () => {
  it("codifica el código y valida lo que llega por la URL", () => {
    assert.equal(stockHref("7791111000011"), "/panel/stock?codigo=7791111000011");
    assert.equal(stockHref(null), "/panel/stock");
    assert.equal(barcodeFromSearch("?codigo=7791111000011"), "7791111000011");
    assert.equal(barcodeFromSearch("?codigo=abc"), null);
    assert.equal(barcodeFromSearch("?codigo=123"), null);
    assert.equal(barcodeFromSearch(""), null);
    assert.equal(barcodeFromSearch("?codigo=7791111000011%3Cscript%3E"), null);
  });
});
