// Pruebas de los cálculos del dashboard. Ejecutar: node --test scripts/pos-analytics.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  periodRange, parseDay, averageTicket, methodShares, monthTotals, monthKey, previousMonthKey, compareMonths, mergeActivity,
  MAX_CUSTOM_DAYS,
} from "../src/lib/pos/analytics.ts";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const iso = (y, m, d) => new Date(y, m - 1, d).toISOString();

describe("períodos", () => {
  const now = at(2026, 11, 15);

  it("hoy: de la medianoche de hoy a la de mañana", () => {
    const r = periodRange("hoy", now);
    assert.equal(r.from, iso(2026, 11, 15));
    assert.equal(r.to, iso(2026, 11, 16));
  });

  it("últimos 7 días: hoy y los 6 anteriores", () => {
    const r = periodRange("7dias", now);
    assert.equal(r.from, iso(2026, 11, 9));
    assert.equal(r.to, iso(2026, 11, 16));
  });

  it("este mes y mes anterior (incluye el cambio de año)", () => {
    assert.deepEqual([periodRange("mes", now).from, periodRange("mes", now).to], [iso(2026, 11, 1), iso(2026, 12, 1)]);
    assert.deepEqual([periodRange("mes-anterior", now).from, periodRange("mes-anterior", now).to], [iso(2026, 10, 1), iso(2026, 11, 1)]);
    const enero = at(2027, 1, 10);
    assert.deepEqual([periodRange("mes-anterior", enero).from, periodRange("mes-anterior", enero).to], [iso(2026, 12, 1), iso(2027, 1, 1)]);
    const diciembre = at(2026, 12, 31, 23);
    assert.equal(periodRange("mes", diciembre).to, iso(2027, 1, 1));
  });

  it("personalizado: el «hasta» es inclusivo (llega hasta la medianoche siguiente)", () => {
    const r = periodRange("personalizado", now, { from: "2026-11-01", to: "2026-11-03" });
    assert.equal(r.from, iso(2026, 11, 1));
    assert.equal(r.to, iso(2026, 11, 4));
    const un = periodRange("personalizado", now, { from: "2026-11-05", to: "2026-11-05" });
    assert.equal(un.to, iso(2026, 11, 6));
  });

  it("personalizado inválido da null: faltante, invertido, fecha inexistente o más de un año", () => {
    assert.equal(periodRange("personalizado", now), null);
    assert.equal(periodRange("personalizado", now, { from: "", to: "2026-11-03" }), null);
    assert.equal(periodRange("personalizado", now, { from: "2026-11-05", to: "2026-11-01" }), null);
    assert.equal(periodRange("personalizado", now, { from: "2026-02-30", to: "2026-03-01" }), null);
    assert.equal(periodRange("personalizado", now, { from: "2025-01-01", to: "2026-11-01" }), null);
    assert.ok(periodRange("personalizado", now, { from: "2026-01-01", to: "2026-12-31" }), `hasta ${MAX_CUSTOM_DAYS} días se acepta`);
  });

  it("parseDay solo acepta fechas reales en formato aaaa-mm-dd", () => {
    assert.ok(parseDay("2026-11-09"));
    for (const v of ["09/11/2026", "2026-13-01", "2026-11-31", "", "2026-1-1"]) assert.equal(parseDay(v), null);
  });
});

describe("ticket promedio", () => {
  it("facturación dividida por ventas, redondeada al peso", () => {
    assert.equal(averageTicket(10000, 4), 2500);
    assert.equal(averageTicket(10000, 3), 3333);
    assert.equal(averageTicket(2, 3), 1);
  });
  it("sin ventas no existe (no es cero)", () => {
    assert.equal(averageTicket(0, 0), null);
    assert.equal(averageTicket(100, 0), null);
    assert.equal(averageTicket(Number.NaN, 2), null);
  });
});

describe("participación por medio de pago", () => {
  const rows = [
    { code: "efectivo", label: "Efectivo", operations: 3, revenue: 6000 },
    { code: "qr", label: "QR", operations: 1, revenue: 2000 },
    { code: "debito", label: "Débito", operations: 0, revenue: 0 },
  ];
  it("porcentaje de la facturación total con un decimal", () => {
    const s = methodShares(rows);
    assert.deepEqual(s.map((x) => x.share), [75, 25, 0]);
    assert.equal(s.reduce((a, b) => a + (b.share ?? 0), 0), 100);
    assert.equal(methodShares([{ code: "a", label: "A", operations: 1, revenue: 1 }, { code: "b", label: "B", operations: 1, revenue: 2 }])[0].share, 33.3);
  });
  it("sin facturación no hay porcentaje (null), no 0 % inventado", () => {
    assert.deepEqual(methodShares(rows.map((r) => ({ ...r, operations: 0, revenue: 0 }))).map((x) => x.share), [null, null, null]);
    assert.deepEqual(methodShares([]), []);
  });
  it("conserva el orden y los datos de entrada", () => {
    assert.deepEqual(methodShares(rows).map((x) => [x.code, x.operations, x.revenue]), rows.map((x) => [x.code, x.operations, x.revenue]));
  });
});

describe("comparación mensual", () => {
  const rows = [
    { month: "2026-10", code: "efectivo", operations: 4, revenue: 8000 },
    { month: "2026-10", code: "qr", operations: 2, revenue: 2000 },
    { month: "2026-11", code: "efectivo", operations: 3, revenue: 9000 },
  ];
  it("totales por mes, de más viejo a más nuevo", () => {
    assert.deepEqual(monthTotals(rows), [
      { month: "2026-10", operations: 6, revenue: 10000 },
      { month: "2026-11", operations: 3, revenue: 9000 },
    ]);
    assert.deepEqual(monthTotals([]), []);
  });
  it("mes en curso contra el anterior: diferencias y variación porcentual", () => {
    const c = compareMonths(rows, "2026-11");
    assert.equal(c.operationsDelta, -3);
    assert.equal(c.revenueDelta, -1000);
    assert.equal(c.revenuePct, -10);
  });
  it("sin datos suficientes no hay comparación: un solo mes, un hueco o vacío", () => {
    assert.equal(compareMonths(rows.slice(0, 2), "2026-11"), null);
    assert.equal(compareMonths(rows.filter((r) => r.month === "2026-11"), "2026-11"), null);
    assert.equal(compareMonths(rows, "2026-12"), null, "el mes anterior a diciembre es noviembre, pero diciembre no tiene ventas");
    assert.equal(compareMonths([], "2026-11"), null);
    assert.equal(compareMonths([{ month: "2026-08", code: "x", operations: 1, revenue: 1 }, { month: "2026-11", code: "x", operations: 1, revenue: 1 }], "2026-11"), null, "meses no consecutivos");
  });
  it("el mes anterior cruza el año", () => {
    assert.equal(previousMonthKey("2027-01"), "2026-12");
    assert.equal(previousMonthKey("2026-11"), "2026-10");
  });
  it("el mes se define en hora de Río Turbio, no en UTC", () => {
    // 01:00 UTC del 1/12 todavía es 30/11 en Argentina (UTC-3).
    assert.equal(monthKey(new Date("2026-12-01T01:00:00Z")), "2026-11");
    assert.equal(monthKey(new Date("2026-12-01T04:00:00Z")), "2026-12");
  });
  it("variación porcentual no definida si el mes anterior facturó 0", () => {
    const c = compareMonths([{ month: "2026-10", code: "x", operations: 1, revenue: 0 }, { month: "2026-11", code: "x", operations: 2, revenue: 500 }], "2026-11");
    assert.equal(c.revenuePct, null);
    assert.equal(c.revenueDelta, 500);
  });
});

describe("actividad reciente", () => {
  const items = [
    { key: "a", kind: "venta", at: "2026-11-09T10:00:00+00:00", title: "Venta #1", amount: 1000, units: 2, detail: "" },
    { key: "b", kind: "entrada", at: "2026-11-09T12:00:00+00:00", title: "Balde", amount: null, units: 10, detail: "" },
    { key: "c", kind: "ajuste", at: "2026-11-08T09:00:00+00:00", title: "Vaso", amount: null, units: -1, detail: "" },
    { key: "d", kind: "venta", at: "2026-11-09T11:00:00.123456+00:00", title: "Venta #2", amount: 500, units: 1, detail: "" },
  ];
  it("ordena del más reciente al más viejo (también con fracciones de segundo)", () => {
    assert.deepEqual(mergeActivity(items, "todo").map((a) => a.key), ["b", "d", "a", "c"]);
  });
  it("filtra ventas o stock y respeta el tope", () => {
    assert.deepEqual(mergeActivity(items, "ventas").map((a) => a.key), ["d", "a"]);
    assert.deepEqual(mergeActivity(items, "stock").map((a) => a.key), ["b", "c"]);
    assert.equal(mergeActivity(items, "todo", 2).length, 2);
  });
  it("no modifica la lista original", () => {
    const copy = JSON.stringify(items);
    mergeActivity(items, "todo");
    assert.equal(JSON.stringify(items), copy);
  });
});
