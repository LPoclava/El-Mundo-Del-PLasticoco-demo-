// Pruebas de las reglas de stock del escáner. Ejecutar: node --test scripts/pos-stock.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkStockOperation, parseStockQuantity, describeStockError } from "../src/lib/pos/stock.ts";

const base = { mode: "entrada", direction: "sumar", quantity: "5", note: "", current: 10 };

describe("cantidad", () => {
  it("solo enteros positivos", () => {
    assert.equal(parseStockQuantity("5"), 5);
    for (const bad of ["", "0", "-1", "1.5", "1,5", "abc", "1e3", "1000001", "99999999"]) assert.equal(parseStockQuantity(bad), null, bad);
  });
});

describe("entrada de mercadería", () => {
  it("siempre suma y el motivo es opcional", () => {
    assert.deepEqual(checkStockOperation(base), { ok: true, delta: 5, resulting: 15 });
    assert.deepEqual(checkStockOperation({ ...base, direction: "restar" }), { ok: true, delta: 5, resulting: 15 });
  });
  it("rechaza cantidades inválidas", () => {
    assert.equal(checkStockOperation({ ...base, quantity: "0" }).ok, false);
    assert.equal(checkStockOperation({ ...base, quantity: "x" }).ok, false);
  });
});

describe("ajuste de inventario", () => {
  const adj = { ...base, mode: "ajuste", note: "Rotura" };
  it("exige motivo", () => {
    const r = checkStockOperation({ ...adj, note: "   " });
    assert.equal(r.ok, false);
    assert.match(r.error, /motivo/);
  });
  it("suma o resta y calcula el resultado", () => {
    assert.deepEqual(checkStockOperation({ ...adj, direction: "sumar" }), { ok: true, delta: 5, resulting: 15 });
    assert.deepEqual(checkStockOperation({ ...adj, direction: "restar" }), { ok: true, delta: -5, resulting: 5 });
  });
  it("no permite dejar el stock en negativo", () => {
    const r = checkStockOperation({ ...adj, direction: "restar", quantity: "11" });
    assert.equal(r.ok, false);
    assert.match(r.error, /negativo/);
    assert.equal(checkStockOperation({ ...adj, direction: "restar", quantity: "10" }).resulting, 0);
  });
  it("limita el largo del motivo", () => {
    assert.equal(checkStockOperation({ ...adj, note: "x".repeat(201) }).ok, false);
  });
});

describe("mensajes de error", () => {
  it("traduce los códigos de la base", () => {
    assert.match(describeStockError({ code: "42501" }), /permiso/);
    assert.match(describeStockError({ code: "23514" }), /negativo/);
    assert.match(describeStockError({ code: "P0002" }), /ya no existe/);
    assert.match(describeStockError(null), /No se pudo/);
  });
});
