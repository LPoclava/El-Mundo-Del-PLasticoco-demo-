// Pruebas de la lógica del carrito. Ejecutar: node --test scripts/pos-cart.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addToCart, parseQuantity, setQuantity, changeQuantity, removeLine, cartTotal, cartUnits, cartIssues,
  attemptSignature, applyProblems, describeProblem,
} from "../src/lib/pos/cart.ts";

const line = (over = {}) => ({
  variantId: "v1", productId: "p1", name: "Balde", variantLabel: null, barcode: "7791111000011",
  imagePath: null, unitPrice: 1000, stock: 5, ...over,
});

describe("agregar al carrito", () => {
  it("crea la línea con cantidad 1 y no duplica la misma variante", () => {
    let r = addToCart([], line());
    assert.equal(r.added, true);
    assert.deepEqual(r.cart.map((l) => [l.variantId, l.quantity]), [["v1", 1]]);
    r = addToCart(r.cart, line());
    r = addToCart(r.cart, line());
    assert.equal(r.cart.length, 1);
    assert.equal(r.cart[0].quantity, 3);
  });

  it("variantes distintas del mismo producto son líneas distintas", () => {
    let r = addToCart([], line({ variantId: "v1", variantLabel: "M" }));
    r = addToCart(r.cart, line({ variantId: "v2", variantLabel: "L" }));
    assert.equal(r.cart.length, 2);
  });

  it("no supera el stock ni agrega sin stock", () => {
    let r = addToCart([], line({ stock: 2 }));
    r = addToCart(r.cart, line({ stock: 2 }));
    assert.equal(r.cart[0].quantity, 2);
    r = addToCart(r.cart, line({ stock: 2 }));
    assert.equal(r.added, false);
    assert.equal(r.reason, "max-stock");
    assert.equal(r.cart[0].quantity, 2);
    const none = addToCart([], line({ stock: 0 }));
    assert.equal(none.added, false);
    assert.equal(none.reason, "no-stock");
    assert.equal(none.cart.length, 0);
  });

  it("al escanear de nuevo toma el precio y el stock más recientes", () => {
    let r = addToCart([], line({ unitPrice: 1000, stock: 5 }));
    r = addToCart(r.cart, line({ unitPrice: 1200, stock: 4 }));
    assert.equal(r.cart[0].unitPrice, 1200);
    assert.equal(r.cart[0].stock, 4);
    assert.equal(r.cart[0].quantity, 2);
  });
});

describe("cantidades", () => {
  it("solo acepta enteros positivos", () => {
    assert.equal(parseQuantity("3"), 3);
    assert.equal(parseQuantity(" 12 "), 12);
    for (const bad of ["", "0", "-1", "1.5", "1,5", "abc", "1e3", "10000", "00000"]) assert.equal(parseQuantity(bad), null, bad);
  });

  it("aumenta y reduce sin salirse de 1 al stock", () => {
    let cart = addToCart([], line({ stock: 2 })).cart;
    cart = changeQuantity(cart, "v1", 1);
    assert.equal(cart[0].quantity, 2);
    cart = changeQuantity(cart, "v1", 1);
    assert.equal(cart[0].quantity, 2, "tope = stock");
    cart = changeQuantity(cart, "v1", -1);
    cart = changeQuantity(cart, "v1", -1);
    assert.equal(cart[0].quantity, 1, "mínimo 1: para sacar la línea está eliminar");
  });

  it("setQuantity ignora valores inválidos y elimina quita la línea", () => {
    let cart = addToCart([], line()).cart;
    assert.equal(setQuantity(cart, "v1", 0)[0].quantity, 1);
    assert.equal(setQuantity(cart, "v1", -3)[0].quantity, 1);
    assert.equal(setQuantity(cart, "v1", 2.5)[0].quantity, 1);
    assert.equal(setQuantity(cart, "v1", 4)[0].quantity, 4);
    assert.deepEqual(removeLine(cart, "v1"), []);
  });
});

describe("totales y validación", () => {
  it("el total y las unidades se actualizan con las líneas", () => {
    let cart = addToCart([], line({ variantId: "a", unitPrice: 1000 }), 2).cart;
    cart = addToCart(cart, line({ variantId: "b", unitPrice: 2500 })).cart;
    assert.equal(cartTotal(cart), 4500);
    assert.equal(cartUnits(cart), 3);
    assert.equal(cartTotal([]), 0);
  });

  it("detecta cantidades fuera de stock, cero y precios inválidos", () => {
    assert.deepEqual(cartIssues([{ ...line(), quantity: 1 }]), []);
    assert.match(cartIssues([{ ...line({ stock: 2 }), quantity: 3 }])[0].message, /Hay 2 en stock/);
    assert.match(cartIssues([{ ...line({ stock: 0 }), quantity: 1 }])[0].message, /Sin stock/);
    assert.match(cartIssues([{ ...line(), quantity: 0 }])[0].message, /1 o más/);
    assert.match(cartIssues([{ ...line({ unitPrice: 0 }), quantity: 1 }])[0].message, /precio/);
  });
});

describe("intento de venta e idempotencia", () => {
  it("la firma cambia con cualquier edición y no depende del orden de las líneas", () => {
    const a = addToCart(addToCart([], line({ variantId: "a" })).cart, line({ variantId: "b" })).cart;
    const b = [...a].reverse();
    assert.equal(attemptSignature(a, "efectivo"), attemptSignature(b, "efectivo"));
    assert.notEqual(attemptSignature(a, "efectivo"), attemptSignature(a, "debito"));
    assert.notEqual(attemptSignature(a, "efectivo"), attemptSignature(changeQuantity(a, "a", 1), "efectivo"));
    assert.notEqual(attemptSignature(a, null), attemptSignature(a, "efectivo"));
  });
});

describe("respuesta del servidor", () => {
  it("actualiza precio y stock sin vaciar el carrito", () => {
    const cart = [{ ...line({ variantId: "a", unitPrice: 1000, stock: 5 }), quantity: 3 }, { ...line({ variantId: "b" }), quantity: 1 }];
    const next = applyProblems(cart, [
      { reason: "PRICE_CHANGED", variant_id: "a", price: 1300 },
      { reason: "INSUFFICIENT_STOCK", variant_id: "b", available: 0 },
    ]);
    assert.equal(next.length, 2);
    assert.equal(next[0].unitPrice, 1300);
    assert.equal(next[0].quantity, 3);
    assert.equal(next[1].stock, 0);
  });

  it("explica cada problema en lenguaje claro", () => {
    assert.match(describeProblem({ reason: "INSUFFICIENT_STOCK", name: "Balde", available: 2, requested: 5 }), /hay 2 y pediste 5/);
    assert.match(describeProblem({ reason: "PRICE_CHANGED", name: "Balde", price: 1300 }), /ahora es \$ 1\.300/);
    assert.match(describeProblem({ reason: "ARCHIVED", name: "Balde" }), /archivado/);
    assert.match(describeProblem({ reason: "OTRA_COSA" }), /No se pudo validar/);
  });
});
