// Etapa 1, fase 5: las cifras del dashboard son consistentes entre sí (PGlite, sin producción).
// sales_summary, sales_by_payment_method y sales_monthly_by_payment_method salen de las mismas ventas: tienen que coincidir.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ID, CAT1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAdmin } from "./helpers.mjs";

let db;
const K = () => crypto.randomUUID();
const PROD = "50000000-0000-4000-8000-0000000000b1";
const V1 = "60000000-0000-4000-8000-0000000000b1";
const V2 = "60000000-0000-4000-8000-0000000000b2";
const FROM = "2000-01-01T00:00:00Z";
const TO = "2100-01-01T00:00:00Z";

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029");
  await seedCatalog(db);
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente', 'gerente', true),
      ('${ID.empleado}', 'Empleada', 'empleado', true);
  `);
});

async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}

const withSales = (fn) =>
  asAdmin(db, async (q) => {
    await q(`insert into public.products (id, name, category_id, barcode, publish_enabled) values ('${PROD}', 'Balde', '${CAT1}', '7793333000011', false)`);
    await q(`insert into public.product_variants (id, product_id, price, position, stock) values ('${V1}', '${PROD}', 1000, 0, 100), ('${V2}', '${PROD}', 2500, 1, 100)`);
    await login(q, ID.empleado);
    const sell = (method, items) => q("select public.confirm_sale($1::uuid, $2, $3::jsonb) as r", [K(), method, JSON.stringify(items)]);
    await sell("efectivo", [{ variant_id: V1, quantity: 3 }]); // 3000
    await sell("efectivo", [{ variant_id: V2, quantity: 1 }]); // 2500
    await sell("qr", [{ variant_id: V1, quantity: 2 }, { variant_id: V2, quantity: 2 }]); // 7000
    await sell("transferencia", [{ variant_id: V1, quantity: 1 }]); // 1000
    return fn(q, sell);
  });

describe("consistencia del dashboard", () => {
  it("ventas, facturación y operaciones coinciden entre el resumen y el análisis por medio de pago", async () => {
    await withSales(async (q) => {
      const s = (await q("select public.sales_summary($1, $2) as r", [FROM, TO])).rows[0].r;
      const p = (await q("select public.sales_by_payment_method($1, $2) as r", [FROM, TO])).rows[0].r;
      assert.equal(Number(s.sales_count), 4);
      assert.equal(Number(s.revenue), 13500);
      assert.equal(Number(s.units), 9);
      assert.equal(p.operations_total, Number(s.sales_count));
      assert.equal(p.revenue_total, Number(s.revenue));
      assert.equal(p.methods.reduce((n, m) => n + m.operations, 0), p.operations_total, "la suma por método es el total");
      assert.equal(p.methods.reduce((n, m) => n + m.revenue, 0), p.revenue_total);
    });
  });

  it("el ticket promedio y la participación se pueden reproducir a mano con las mismas cifras", async () => {
    await withSales(async (q) => {
      const p = (await q("select public.sales_by_payment_method($1, $2) as r", [FROM, TO])).rows[0].r;
      assert.equal(Math.round(p.revenue_total / p.operations_total), 3375); // 13500 / 4
      const by = Object.fromEntries(p.methods.map((m) => [m.code, m]));
      assert.deepEqual([by.efectivo.operations, by.efectivo.revenue], [2, 5500]);
      assert.deepEqual([by.qr.operations, by.qr.revenue], [1, 7000]);
      assert.deepEqual([by.transferencia.operations, by.transferencia.revenue], [1, 1000]);
      assert.equal(Math.round((by.qr.revenue / p.revenue_total) * 1000) / 10, 51.9);
    });
  });

  it("el contador mensual suma lo mismo que el análisis cuando el período es el mes en curso", async () => {
    await withSales(async (q) => {
      const monthly = (await q("select public.sales_monthly_by_payment_method(6) as r")).rows[0].r;
      assert.equal(monthly.reduce((n, r) => n + r.operations, 0), 4);
      assert.equal(monthly.reduce((n, r) => n + r.revenue, 0), 13500);
      assert.equal(new Set(monthly.map((r) => r.month)).size, 1, "todas son del mes actual");
    });
  });

  it("un período sin ventas devuelve ceros y la lista de métodos (nada inventado)", async () => {
    await withSales(async (q) => {
      const p = (await q("select public.sales_by_payment_method('2000-01-01', '2000-02-01') as r")).rows[0].r;
      assert.equal(p.operations_total, 0);
      assert.equal(p.revenue_total, 0);
      assert.ok(p.methods.every((m) => m.operations === 0 && m.revenue === 0));
      const s = (await q("select public.sales_summary('2000-01-01', '2000-02-01') as r")).rows[0].r;
      assert.equal(Number(s.sales_count), 0);
    });
  });

  it("el empleado ve solo lo suyo y el gerente ve todo, con las mismas cifras en ambos análisis", async () => {
    await withSales(async (q, sell) => {
      await login(q, ID.gerente);
      await sell("debito", [{ variant_id: V1, quantity: 1 }]);
      const manager = (await q("select public.sales_by_payment_method($1, $2) as r", [FROM, TO])).rows[0].r;
      const managerSummary = (await q("select public.sales_summary($1, $2) as r", [FROM, TO])).rows[0].r;
      assert.equal(manager.operations_total, 5);
      assert.equal(manager.operations_total, Number(managerSummary.sales_count));
      await login(q, ID.empleado);
      const own = (await q("select public.sales_by_payment_method($1, $2) as r", [FROM, TO])).rows[0].r;
      assert.equal(own.operations_total, 4);
    });
  });
});
