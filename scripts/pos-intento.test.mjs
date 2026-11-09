// Hallazgo H1 (fase 0.4): una venta con resultado incierto no puede duplicarse. Pruebas de la lógica pura del
// navegador (src/lib/pos/attempt.ts) contra un «servidor» simulado que se comporta como confirm_sale (una venta por
// usuario y clave; reintento con la misma clave devuelve la misma venta; descuenta stock y registra movimientos).
// Ejecutar: node --test scripts/pos-intento.test.mjs
//
// El servidor simulado NO reemplaza a la base real: que confirm_sale se comporta así lo prueban supabase/tests
// (pos-ventas, pos-integridad y pos-recuperacion con PGlite) y concurrency.mjs (PostgreSQL real, conexiones separadas).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ATTEMPT_KEY, DISCARD_AFTER_MS, attemptTotal, attemptUnits, canDiscard, clearAttempt, loadAttempt, parseAttempt,
  planConfirm, receiptMatchesAttempt, runConfirm, saveAttempt, verifyAttempt,
} from "../src/lib/pos/attempt.ts";
import { attemptSignature } from "../src/lib/pos/cart.ts";

const USER = "00000000-0000-4000-8000-000000000004";
const OTHER = "00000000-0000-4000-8000-000000000009";
const V1 = "61000000-0000-4000-8000-000000000001";
const V2 = "61000000-0000-4000-8000-000000000002";
const PRICE = { [V1]: 1000, [V2]: 2500 };
const UNKNOWN = { kind: "unknown", message: "No pudimos confirmar si la venta se registró.", problems: [] };

const cartOf = (spec) =>
  spec.map(([variantId, quantity]) => ({
    variantId, productId: "p", name: variantId.slice(-2), variantLabel: null, barcode: null, imagePath: null,
    unitPrice: PRICE[variantId], quantity, stock: 99,
  }));
const linesOf = (cart) => cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice }));

/** Almacenamiento de sesión simulado; roto = lanza como un navegador sin espacio o en ventana privada. */
function makeStorage() {
  const m = new Map();
  const s = {
    broken: false,
    getItem: (k) => { if (s.broken) throw new Error("storage roto"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (s.broken) throw new Error("storage roto"); m.set(k, v); },
    removeItem: (k) => { if (s.broken) throw new Error("storage roto"); m.delete(k); },
    raw: () => m.get(ATTEMPT_KEY) ?? null,
  };
  return s;
}

/** Mundo simulado: la base (ventas, detalle, movimientos, stock), la red y el navegador. */
function makeWorld({ stock = { [V1]: 10, [V2]: 5 }, net = [], findFails = 0 } = {}) {
  const w = {
    sales: [], items: [], movements: [], stock: { ...stock }, number: 0,
    sendCalls: 0, serverRuns: 0, findCalls: 0, clock: 1_000_000, uuidN: 0, net: [...net], findFails,
    storage: makeStorage(), seenInStorageOnSend: [],
  };

  const receiptOf = (sale, replayed, withStock) => ({
    id: sale.id, number: sale.number, createdAt: "2026-11-08T15:30:00.000Z", userName: "Empleada Uno",
    paymentMethod: sale.method, paymentLabel: sale.method, total: sale.total, replayed, stockUpdated: true,
    items: w.items.filter((i) => i.saleId === sale.id).map((i) => ({
      productName: i.variantId.slice(-2), variantLabel: null, barcode: null, unitPrice: i.unitPrice, quantity: i.quantity,
      subtotal: i.unitPrice * i.quantity, stockAfter: withStock ? w.stock[i.variantId] : null,
    })),
  });

  /** confirm_sale: una venta por (usuario, clave); si ya existe, la devuelve; si no, valida, registra y descuenta, todo junto. */
  w.server = (userId, key, method, lines) => {
    w.serverRuns++;
    const existing = w.sales.find((s) => s.userId === userId && s.key === key);
    if (existing) return { receipt: receiptOf(existing, true, true) };
    const need = {};
    for (const l of lines) need[l.variantId] = (need[l.variantId] ?? 0) + l.quantity;
    for (const [id, q] of Object.entries(need)) {
      if (w.stock[id] < q) return { failure: { kind: "rejected", message: "La venta no se registró.", problems: [{ reason: "INSUFFICIENT_STOCK", variant_id: id, available: w.stock[id], requested: q }] } };
    }
    const sale = { id: `sale-${++w.number}`, number: w.number, userId, key, method, total: lines.reduce((s, l) => s + PRICE[l.variantId] * l.quantity, 0) };
    w.sales.push(sale);
    for (const l of lines) {
      w.items.push({ saleId: sale.id, variantId: l.variantId, unitPrice: PRICE[l.variantId], quantity: l.quantity });
      w.stock[l.variantId] -= l.quantity;
      w.movements.push({ saleId: sale.id, variantId: l.variantId, delta: -l.quantity });
    }
    return { receipt: receiptOf(sale, false, true) };
  };

  w.deps = (userId = USER) => ({
    uuid: () => `00000000-0000-4000-8000-${String(++w.uuidN).padStart(12, "0")}`,
    now: () => w.clock,
    find: async (key) => {
      w.findCalls++;
      if (w.findFails > 0) { w.findFails--; throw new Error("sin conexión"); }
      const sale = w.sales.find((s) => s.userId === userId && s.key === key);
      return sale ? receiptOf(sale, true, false) : null;
    },
    send: async (key, method, lines) => {
      w.sendCalls++;
      // Lo que hay guardado en el navegador en el instante en que el pedido sale hacia el servidor.
      w.seenInStorageOnSend.push(loadAttempt(userId, w.storage));
      await Promise.resolve(); // cede el turno: permite que dos pedidos se crucen
      const mode = w.net.shift() ?? "ok";
      if (mode === "cut-before") return { failure: UNKNOWN };
      const out = w.server(userId, key, method, lines);
      if (mode === "lose-response") return { failure: UNKNOWN };
      return out;
    },
    save: (a) => saveAttempt(a, w.storage),
    clear: () => clearAttempt(w.storage),
  });

  /** Estado completo de la base, con las invariantes que no pueden romperse nunca. */
  w.ledger = () => {
    for (const s of w.sales) {
      const its = w.items.filter((i) => i.saleId === s.id);
      assert.ok(its.length > 0, `venta ${s.id} sin detalle`);
      assert.equal(its.reduce((t, i) => t + i.unitPrice * i.quantity, 0), s.total, `total de ${s.id}`);
      assert.equal(its.reduce((t, i) => t + i.quantity, 0), -w.movements.filter((m) => m.saleId === s.id).reduce((t, m) => t + m.delta, 0), `movimientos de ${s.id}`);
    }
    assert.equal(new Set(w.sales.map((s) => `${s.userId}:${s.key}`)).size, w.sales.length, "dos ventas con la misma clave");
    return { sales: w.sales.length, items: w.items.length, movements: w.movements.length, stock: { ...w.stock }, methods: w.sales.map((s) => s.method), totals: w.sales.map((s) => s.total) };
  };
  return w;
}

/** Una pantalla que confirma lo que hay en el carrito (o reintenta lo pendiente). */
async function confirm(w, cart, method, pending = null, userId = USER) {
  return runConfirm({
    userId, pending, sig: pending ? pending.sig : attemptSignature(cart, method), method: pending ? pending.method : method,
    lines: pending ? pending.lines : linesOf(cart), deps: w.deps(userId),
  });
}

describe("H1: reintento con la misma clave y el mismo carrito", () => {
  it("un corte ANTES de llegar al servidor deja un intento pendiente; reintentar lo registra UNA vez", async () => {
    const w = makeWorld({ net: ["cut-before"] });
    const cart = cartOf([[V1, 2], [V2, 1]]);
    const a = await confirm(w, cart, "transferencia");
    assert.equal(a.kind, "unknown");
    assert.equal(w.ledger().sales, 0, "el servidor no recibió nada");
    assert.equal(a.attempt.status, "unknown");
    assert.deepEqual(loadAttempt(USER, w.storage)?.key, a.attempt.key, "la clave quedó guardada");

    const b = await confirm(w, cart, "transferencia", a.attempt);
    assert.equal(b.kind, "registered");
    assert.equal(b.via, "sent");
    const l = w.ledger();
    assert.deepEqual([l.sales, l.items, l.movements, l.methods, l.totals], [1, 2, 2, ["transferencia"], [4500]]);
    assert.deepEqual(l.stock, { [V1]: 8, [V2]: 4 });
    assert.equal(w.storage.raw(), null, "al registrarse, el intento se cierra");
  });

  it("la misma clave sale en cada reintento (no se genera otra)", async () => {
    const w = makeWorld({ net: ["cut-before", "cut-before", "cut-before"] });
    const cart = cartOf([[V1, 1]]);
    let attempt = (await confirm(w, cart, "efectivo")).attempt;
    const key = attempt.key;
    for (let i = 0; i < 2; i++) {
      const r = await confirm(w, cart, "efectivo", attempt);
      assert.equal(r.kind, "unknown");
      attempt = r.attempt;
      assert.equal(attempt.key, key);
    }
    assert.equal(w.uuidN, 1, "se generó una sola clave en total");
  });
});

describe("H1: la clave y lo enviado se guardan ANTES de enviar", () => {
  it("cuando el pedido sale hacia el servidor, el intento ya está guardado con su clave, medio y renglones", async () => {
    const w = makeWorld();
    await confirm(w, cartOf([[V1, 3]]), "debito");
    const seen = w.seenInStorageOnSend[0];
    assert.ok(seen, "no había nada guardado al enviar");
    assert.equal(seen.status, "sending");
    assert.equal(seen.method, "debito");
    assert.deepEqual(seen.lines, [{ variantId: V1, quantity: 3, unitPrice: 1000 }]);
  });
});

describe("H1: recarga de la página con una venta pendiente", () => {
  it("recarga tras un corte antes de llegar: se consulta, no hay venta, y se reintenta con la misma clave (una sola venta)", async () => {
    const w = makeWorld({ net: ["cut-before"] });
    const cart = cartOf([[V1, 2]]);
    const first = await confirm(w, cart, "efectivo");
    const key = first.attempt.key;

    // —— recarga: la memoria se pierde, queda lo guardado ——
    const pending = loadAttempt(USER, w.storage);
    assert.equal(pending.key, key);
    const v = await verifyAttempt(pending, w.deps());
    assert.equal(v.kind, "not-registered");
    assert.equal(w.ledger().sales, 0);

    const r = await confirm(w, cart, "efectivo", pending);
    assert.equal(r.kind, "registered");
    assert.equal(w.ledger().sales, 1);
    assert.equal(w.sales[0].key, key, "la venta se registró con la clave original");
  });

  it("recarga con la venta YA registrada (se perdió la respuesta): la consulta la encuentra y NO se envía otra vez", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const cart = cartOf([[V1, 2], [V2, 1]]);
    const first = await confirm(w, cart, "credito");
    assert.equal(first.kind, "unknown");
    assert.equal(w.ledger().sales, 1, "la base sí la registró");

    const pending = loadAttempt(USER, w.storage); // tras la recarga
    const v = await verifyAttempt(pending, w.deps());
    assert.equal(v.kind, "registered");
    assert.equal(v.receipt.number, 1);
    assert.equal(w.sendCalls, 1, "no se reenvió nada");
    assert.equal(w.storage.raw(), null, "el intento se cerró");
    assert.deepEqual(w.ledger().stock, { [V1]: 8, [V2]: 4 }, "el stock bajó una sola vez");
  });

  it("recarga A MITAD del envío (el intento quedó como «sending»): se trata como incierto y se resuelve igual", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    await confirm(w, cartOf([[V1, 1]]), "efectivo");
    const pending = loadAttempt(USER, w.storage);
    pending.status = "sending"; // lo que queda guardado si la página se cierra con el pedido en vuelo
    saveAttempt(pending, w.storage);
    const again = loadAttempt(USER, w.storage);
    assert.equal(again.status, "sending");
    const v = await verifyAttempt(again, w.deps());
    assert.equal(v.kind, "registered");
    assert.equal(w.ledger().sales, 1);
  });
});

describe("H1: corte de red DESPUÉS de confirmar en la base, y respuesta perdida", () => {
  it("la base confirmó pero la respuesta no llegó: reintentar encuentra la venta y no la duplica", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const cart = cartOf([[V2, 2]]);
    const a = await confirm(w, cart, "efectivo");
    assert.equal(a.kind, "unknown");
    const sendsBefore = w.sendCalls;

    const b = await confirm(w, cart, "efectivo", a.attempt);
    assert.equal(b.kind, "registered");
    assert.equal(b.via, "found", "se reconoció por la consulta previa");
    assert.equal(w.sendCalls, sendsBefore, "ni siquiera hizo falta reenviar");
    const l = w.ledger();
    assert.deepEqual([l.sales, l.items, l.movements], [1, 1, 1]);
    assert.deepEqual(l.stock, { [V1]: 10, [V2]: 3 });
    assert.equal(b.receipt.total, 5000);
  });

  it("si la consulta previa no se pudo hacer, NO se reenvía a ciegas: queda pendiente", async () => {
    const w = makeWorld({ net: ["lose-response"], findFails: 1 });
    const cart = cartOf([[V1, 1]]);
    const a = await confirm(w, cart, "efectivo");
    const b = await confirm(w, cart, "efectivo", a.attempt);
    assert.equal(b.kind, "lookup-failed");
    assert.equal(w.sendCalls, 1, "no se envió otra vez sin saber");
    assert.equal(w.ledger().sales, 1);
    assert.ok(loadAttempt(USER, w.storage), "el intento sigue guardado");

    const c = await confirm(w, cart, "efectivo", b.attempt); // ahora la consulta responde
    assert.equal(c.kind, "registered");
    assert.equal(w.ledger().sales, 1, "sigue habiendo una sola venta");
  });

  it("si el servidor no responde nunca y no se sabe qué pasó, la venta siguiente queda bloqueada hasta resolver", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const a = await confirm(w, cartOf([[V1, 1]]), "efectivo");
    const other = cartOf([[V2, 1]]); // otro contenido
    const r = await runConfirm({ userId: USER, pending: a.attempt, sig: attemptSignature(other, "efectivo"), method: "efectivo", lines: linesOf(other), deps: w.deps() });
    assert.equal(r.kind, "blocked");
    assert.equal(w.serverRuns, 1, "no se tocó el servidor");
    assert.equal(w.ledger().sales, 1);
  });
});

describe("H1: carrito modificado después de un resultado incierto", () => {
  it("con otro contenido, la misma clave NO se reutiliza ni se genera una nueva: se bloquea", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const original = cartOf([[V1, 2]]);
    const a = await confirm(w, original, "efectivo");
    const edited = cartOf([[V1, 3]]); // alguien le sube una unidad
    assert.notEqual(attemptSignature(edited, "efectivo"), a.attempt.sig);
    assert.equal(planConfirm(a.attempt, attemptSignature(edited, "efectivo")), "blocked");

    const r = await runConfirm({ userId: USER, pending: a.attempt, sig: attemptSignature(edited, "efectivo"), method: "efectivo", lines: linesOf(edited), deps: w.deps() });
    assert.equal(r.kind, "blocked");
    assert.equal(w.uuidN, 1, "no se generó otra clave");
    assert.equal(w.sendCalls, 1);
    assert.equal(w.ledger().sales, 1, "sin ventas duplicadas");
  });

  it("cambiar el medio de pago también cuenta como otro contenido", async () => {
    const w = makeWorld({ net: ["cut-before"] });
    const cart = cartOf([[V1, 1]]);
    const a = await confirm(w, cart, "efectivo");
    assert.equal(planConfirm(a.attempt, attemptSignature(cart, "credito")), "blocked");
  });

  it("el único camino de salida con la venta ya registrada es consultar: aparece su comprobante y se libera", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const a = await confirm(w, cartOf([[V1, 2]]), "efectivo");
    const v = await verifyAttempt(a.attempt, w.deps());
    assert.equal(v.kind, "registered");
    // Liberado: ahora sí se puede armar otra venta, con otra clave, y son dos ventas distintas y correctas.
    const next = await confirm(w, cartOf([[V1, 1]]), "efectivo");
    assert.equal(next.kind, "registered");
    assert.equal(w.ledger().sales, 2);
    assert.deepEqual(w.ledger().stock, { [V1]: 7, [V2]: 5 });
  });
});

describe("H1: la misma clave no puede confirmar dos ventas distintas", () => {
  it("si la clave ya tenía una venta con OTRO contenido, no se la presenta como la venta de ahora (mismatch)", async () => {
    const w = makeWorld();
    // Otra operación ya registró algo con una clave; un intento con esa misma clave pero otro contenido la encuentra.
    const key = "00000000-0000-4000-8000-0000000000aa";
    w.server(USER, key, "efectivo", linesOf(cartOf([[V1, 1]])));
    const stale = { userId: USER, key, method: "efectivo", sig: "otra", lines: linesOf(cartOf([[V2, 4]])), status: "unknown", lastSentAt: 0 };
    const r = await runConfirm({ userId: USER, pending: stale, sig: "otra", method: "efectivo", lines: stale.lines, deps: w.deps() });
    assert.equal(r.kind, "mismatch");
    assert.equal(w.ledger().sales, 1, "no se registró una segunda venta con esa clave");
    assert.equal(w.storage.raw(), null);
  });

  it("receiptMatchesAttempt compara total y unidades", () => {
    const a = { lines: [{ variantId: V1, quantity: 2, unitPrice: 1000 }, { variantId: V2, quantity: 1, unitPrice: 2500 }] };
    assert.equal(attemptTotal(a), 4500);
    assert.equal(attemptUnits(a), 3);
    assert.equal(receiptMatchesAttempt(a, { total: 4500, items: [{ quantity: 2 }, { quantity: 1 }] }), true);
    assert.equal(receiptMatchesAttempt(a, { total: 4501, items: [{ quantity: 2 }, { quantity: 1 }] }), false);
    assert.equal(receiptMatchesAttempt(a, { total: 4500, items: [{ quantity: 3 }] }), true, "mismas unidades y total");
    assert.equal(receiptMatchesAttempt(a, { total: 4500, items: [{ quantity: 4 }] }), false);
  });

  it("el servidor simulado, como la base real, devuelve la venta original ante la misma clave con otro contenido", async () => {
    const w = makeWorld();
    const key = "00000000-0000-4000-8000-0000000000bb";
    const a = w.server(USER, key, "efectivo", linesOf(cartOf([[V1, 1]])));
    const b = w.server(USER, key, "credito", linesOf(cartOf([[V2, 4]])));
    assert.equal(b.receipt.id, a.receipt.id);
    assert.equal(b.receipt.replayed, true);
    assert.equal(w.ledger().sales, 1);
  });
});

describe("H1: dos solicitudes simultáneas con la misma clave", () => {
  it("las dos pantallas (o dos toques) reintentan a la vez: una sola venta, las dos reciben el mismo comprobante", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    const cart = cartOf([[V1, 2]]);
    const a = await confirm(w, cart, "efectivo");
    const [r1, r2] = await Promise.all([confirm(w, cart, "efectivo", a.attempt), confirm(w, cart, "efectivo", a.attempt)]);
    assert.equal(r1.kind, "registered");
    assert.equal(r2.kind, "registered");
    assert.equal(r1.receipt.id, r2.receipt.id);
    assert.equal(w.ledger().sales, 1);
    assert.deepEqual(w.ledger().stock, { [V1]: 8, [V2]: 5 });
  });

  it("dos envíos nuevos con la misma clave que llegan juntos: la base registra uno y reconoce el otro", async () => {
    const w = makeWorld();
    const key = "00000000-0000-4000-8000-0000000000cc";
    const lines = linesOf(cartOf([[V2, 1]]));
    const [x, y] = await Promise.all([w.deps().send(key, "efectivo", lines), w.deps().send(key, "efectivo", lines)]);
    assert.ok("receipt" in x && "receipt" in y);
    assert.equal(x.receipt.id, y.receipt.id);
    assert.deepEqual([x.receipt.replayed, y.receipt.replayed].sort(), [false, true]);
    assert.equal(w.ledger().sales, 1);
  });
});

describe("H1: error de persistencia del borrador (el navegador no puede guardar)", () => {
  it("si no se puede guardar, la venta igual se registra una vez y se avisa que no quedó guardada", async () => {
    const w = makeWorld();
    w.storage.broken = true;
    const r = await confirm(w, cartOf([[V1, 1]]), "efectivo");
    assert.equal(r.kind, "registered");
    assert.equal(r.persisted, false);
    assert.equal(w.ledger().sales, 1);
  });

  it("si no se puede guardar y el resultado es incierto, el intento sigue vivo en memoria y bloquea otra venta", async () => {
    const w = makeWorld({ net: ["lose-response"] });
    w.storage.broken = true;
    const cart = cartOf([[V1, 2]]);
    const a = await confirm(w, cart, "efectivo");
    assert.equal(a.kind, "unknown");
    assert.equal(a.persisted, false, "la pantalla debe avisar: no recargues");
    assert.equal(planConfirm(a.attempt, attemptSignature(cartOf([[V1, 3]]), "efectivo")), "blocked");

    // Aun sin almacenamiento, con el intento en memoria se reintenta con la misma clave y no se duplica.
    const b = await confirm(w, cart, "efectivo", a.attempt);
    assert.equal(b.kind, "registered");
    assert.equal(b.via, "found");
    assert.equal(w.ledger().sales, 1);
  });

  it("saveAttempt devuelve false (no lanza) con un almacenamiento roto o inexistente; load y clear tampoco lanzan", () => {
    const w = makeWorld();
    w.storage.broken = true;
    const attempt = { userId: USER, key: "00000000-0000-4000-8000-0000000000dd", method: "efectivo", sig: "s", lines: [{ variantId: V1, quantity: 1, unitPrice: 1000 }], status: "unknown", lastSentAt: 1 };
    assert.equal(saveAttempt(attempt, w.storage), false);
    assert.equal(saveAttempt(attempt, null), false);
    assert.equal(loadAttempt(USER, w.storage), null);
    assert.doesNotThrow(() => clearAttempt(w.storage));
    assert.doesNotThrow(() => clearAttempt(null));
  });
});

describe("H1: cierre del intento según lo que respondió la base", () => {
  it("un rechazo (stock insuficiente) cierra el intento: no se registró nada y el carrito se puede corregir", async () => {
    const w = makeWorld({ stock: { [V1]: 1, [V2]: 5 } });
    const r = await confirm(w, cartOf([[V1, 3]]), "efectivo");
    assert.equal(r.kind, "failed");
    assert.equal(r.failure.kind, "rejected");
    assert.equal(w.storage.raw(), null);
    const l = w.ledger();
    assert.deepEqual([l.sales, l.items, l.movements], [0, 0, 0]);
    assert.deepEqual(l.stock, { [V1]: 1, [V2]: 5 });
  });

  it("tras el rechazo, corregir el carrito genera una clave nueva (no queda atado al intento rechazado)", async () => {
    const w = makeWorld({ stock: { [V1]: 1, [V2]: 5 } });
    const a = await confirm(w, cartOf([[V1, 3]]), "efectivo");
    assert.equal(a.kind, "failed");
    const b = await confirm(w, cartOf([[V1, 1]]), "efectivo");
    assert.equal(b.kind, "registered");
    assert.equal(w.uuidN, 2);
    assert.equal(w.ledger().sales, 1);
  });

  it("falta de permiso y datos inválidos también cierran el intento", async () => {
    for (const kind of ["forbidden", "invalid"]) {
      const w = makeWorld();
      const deps = { ...w.deps(), send: async () => ({ failure: { kind, message: "x", problems: [] } }) };
      const r = await runConfirm({ userId: USER, pending: null, sig: "s", method: "efectivo", lines: linesOf(cartOf([[V1, 1]])), deps });
      assert.equal(r.kind, "failed");
      assert.equal(w.storage.raw(), null, kind);
    }
  });

  it("un envío que lanza una excepción inesperada se trata como incierto, no como fallo", async () => {
    const w = makeWorld();
    const deps = { ...w.deps(), send: async () => { throw new Error("boom"); } };
    const r = await runConfirm({ userId: USER, pending: null, sig: "s", method: "efectivo", lines: linesOf(cartOf([[V1, 1]])), deps });
    assert.equal(r.kind, "unknown");
    assert.ok(loadAttempt(USER, w.storage));
  });
});

describe("H1: descartar un intento solo es seguro pasado el margen y con la venta confirmada como inexistente", () => {
  it("canDiscard: exige «no registrada» y que hayan pasado DISCARD_AFTER_MS desde el último envío", () => {
    const a = { lastSentAt: 1_000 };
    assert.equal(canDiscard(a, false, 1_000 + DISCARD_AFTER_MS - 1), false, "todavía puede estar procesándose");
    assert.equal(canDiscard(a, false, 1_000 + DISCARD_AFTER_MS), true);
    assert.equal(canDiscard(a, null, 1_000 + DISCARD_AFTER_MS * 10), false, "sin poder consultar, nunca");
    assert.equal(canDiscard(a, true, 1_000 + DISCARD_AFTER_MS * 10), false, "si está registrada no se descarta: se muestra");
  });

  it("el margen es mucho mayor que el límite de duración de una consulta de Supabase", () => {
    assert.ok(DISCARD_AFTER_MS >= 60_000);
  });
});

describe("H1: el intento guardado", () => {
  const good = {
    userId: USER, key: "00000000-0000-4000-8000-0000000000ee", method: "efectivo", sig: "efectivo|x",
    lines: [{ variantId: V1, quantity: 2, unitPrice: 1000 }], status: "unknown", lastSentAt: 5,
  };

  it("se guarda y se lee igual, y solo lo ve la cuenta que lo armó", () => {
    const s = makeStorage();
    assert.equal(saveAttempt(good, s), true);
    assert.deepEqual(loadAttempt(USER, s), good);
    assert.equal(loadAttempt(OTHER, s), null, "otra cuenta en el mismo navegador no ve ni retoma el intento");
  });

  for (const [nombre, raw] of [
    ["vacío", null],
    ["texto que no es JSON", "no es json"],
    ["lista", "[]"],
    ["sin renglones", JSON.stringify({ ...good, lines: [] })],
    ["clave que no es UUID", JSON.stringify({ ...good, key: "abc" })],
    ["usuario que no es UUID", JSON.stringify({ ...good, userId: "x" })],
    ["cantidad cero", JSON.stringify({ ...good, lines: [{ variantId: V1, quantity: 0, unitPrice: 10 }] })],
    ["cantidad decimal", JSON.stringify({ ...good, lines: [{ variantId: V1, quantity: 1.5, unitPrice: 10 }] })],
    ["precio negativo", JSON.stringify({ ...good, lines: [{ variantId: V1, quantity: 1, unitPrice: -1 }] })],
    ["estado desconocido", JSON.stringify({ ...good, status: "listo" })],
    ["más de 100 renglones", JSON.stringify({ ...good, lines: Array.from({ length: 101 }, () => good.lines[0]) })],
  ]) {
    it(`un intento dañado (${nombre}) se descarta entero`, () => {
      assert.equal(parseAttempt(raw), null);
    });
  }
});

describe("H1: está conectado a la pantalla", () => {
  const SRC = join(import.meta.dirname, "..", "src");
  const section = readFileSync(join(SRC, "components", "panel", "pos", "pos-section.tsx"), "utf8");
  const drawer = readFileSync(join(SRC, "components", "panel", "pos", "pos-cart-drawer.tsx"), "utf8");
  const api = readFileSync(join(SRC, "lib", "pos", "api.ts"), "utf8");

  it("la pantalla ya no guarda la clave solo en memoria: usa runConfirm y el intento guardado", () => {
    assert.match(section, /runConfirm\(/);
    assert.match(section, /loadAttempt\(userId\)/);
    assert.doesNotMatch(section, /attemptRef/, "no debe quedar la clave en un ref en memoria");
    // La única generación de claves es la dependencia `uuid` que usa runConfirm: nadie más fabrica una clave nueva.
    assert.equal((section.match(/crypto\.randomUUID\(\)/g) ?? []).length, 1);
    assert.match(section, /uuid: \(\) => crypto\.randomUUID\(\)/);
  });

  it("al entrar con un intento pendiente se consulta de inmediato", () => {
    assert.match(section, /verifyAttempt\(p, attemptDeps\)/);
  });

  it("con una venta sin confirmar no se puede agregar, cambiar el carrito ni vaciarlo", () => {
    assert.match(section, /sendingRef\.current \|\| pendingRef\.current/);
    for (const action of ["setQuantity", "step", "remove", "clear"]) assert.match(section, new RegExp(`${action}:[^\\n]*(blocked|pendingRef)|clear: \\(\\) => \\{\\s*if \\(pendingRef\\.current\\)`), action);
  });

  it("el aviso de venta incierta no afirma «No se registró nada»", () => {
    assert.match(drawer, /failure\.kind !== "unknown"/);
    assert.match(drawer, /failure && !pending/);
    assert.match(drawer, /Hay una venta sin confirmar/);
  });

  it("la consulta por clave filtra por la cuenta (un gerente ve ventas de todos)", () => {
    const fn = api.slice(api.indexOf("export async function findSaleByKey"));
    assert.match(fn, /\.eq\("user_id", userId\)/);
    assert.match(fn, /\.eq\("idempotency_key", key\)/);
  });

  it("al cerrar la ventana con una venta sin confirmar se pide confirmación", () => {
    assert.match(section, /cart\.length > 0 \|\| pending !== null \|\| busy/);
  });
});
