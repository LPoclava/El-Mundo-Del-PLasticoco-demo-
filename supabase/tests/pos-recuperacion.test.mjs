// H1 (fase 0.4): recuperación de una venta cuya respuesta se perdió, contra PostgreSQL real (PGlite) con las
// migraciones del repositorio. Verifica lo que la pantalla necesita de la base: consultar por clave de operación qué
// venta existe (sin una función nueva, con la RLS actual), que reenviar con la misma clave no duplica nada y que ninguna
// cuenta ve las ventas de otra. La parte del navegador (clave guardada, bloqueo, consulta previa) se prueba en
// scripts/pos-intento.test.mjs; la competencia real entre conexiones, en concurrency.mjs.
// Ejecutar: cd supabase/tests && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAdmin,
} from "./helpers.mjs";
import { receiptMatchesAttempt } from "../../src/lib/pos/attempt.ts";

let db;
const K = () => crypto.randomUUID();
const PROD = { balde: "90000000-0000-4000-8000-000000000001", remera: "90000000-0000-4000-8000-000000000002" };
const VAR = { balde: "91000000-0000-4000-8000-000000000001", remeraM: "91000000-0000-4000-8000-000000000002" };

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029");
  await seedCatalog(db);
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente Uno', 'gerente', true),
      ('${ID.empleado}', 'Empleada Uno', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', true);
  `);
});

async function seed() {
  await db.exec(`
    insert into public.products (id, name, category_id, barcode, publish_enabled) values
      ('${PROD.balde}', 'Balde reforzado 10L', '${CAT1}', '7796666000011', false),
      ('${PROD.remera}', 'Remera lisa', '${CAT1}', '7796666000028', false);
    insert into public.product_variants (id, product_id, size, color, price, position, stock) values
      ('${VAR.balde}', '${PROD.balde}', null, null, 1000, 0, 10),
      ('${VAR.remeraM}', '${PROD.remera}', 'M', 'Azul', 2500, 0, 5);
  `);
}
async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}
async function sqlEditor(q) {
  await q("reset role");
  await q("select set_config('request.jwt.claims', '', true)");
}
const asSuper = (fn) => asAdmin(db, async (q) => { await seed(); return fn(q); });
const SELL = "select public.confirm_sale($1::uuid, $2, $3::jsonb) as r";
const sell = (q, items, method = "efectivo", key = K()) => q(SELL, [key, method, JSON.stringify(items)]).then((x) => x.rows[0].r);
const n = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);
const stockOf = async (q, id) => Number((await q("select stock from public.product_variants where id = $1", [id])).rows[0].stock);

/**
 * Lo mismo que pide findSaleByKey en la pantalla (PostgREST con la RLS de quien consulta): la venta de ESTA cuenta con
 * ESA clave, con su detalle.
 */
const FIND = `select s.id, s.number, s.created_at, s.user_name, s.payment_method, s.total,
  (select jsonb_agg(jsonb_build_object('product_name', i.product_name, 'variant_label', i.variant_label, 'barcode', i.barcode,
                                       'unit_price', i.unit_price, 'quantity', i.quantity, 'subtotal', i.subtotal) order by i.product_name)
     from public.sale_items i where i.sale_id = s.id) as items
  from public.sales s where s.user_id = $1 and s.idempotency_key = $2`;

async function counts(q) {
  await sqlEditor(q);
  return {
    sales: await n(q, "select count(*) n from public.sales"),
    items: await n(q, "select count(*) n from public.sale_items"),
    movements: await n(q, "select count(*) n from public.stock_movements where reason = 'venta'"),
  };
}
async function assertLedger(q) {
  await sqlEditor(q);
  assert.equal(await n(q, "select count(*) n from public.sales s where s.total <> (select sum(i.subtotal) from public.sale_items i where i.sale_id = s.id)"), 0);
  assert.equal(await n(q, "select count(*) n from public.product_variants v where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0)"), 0);
}

describe("consultar por clave qué venta existe", () => {
  it("la consulta devuelve la misma venta que devolvió confirm_sale: id, número, total, medio de pago y renglones", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 3 }, { variant_id: VAR.remeraM, quantity: 1, expected_price: 2500 }], "transferencia", key);
      const found = (await q(FIND, [ID.empleado, key])).rows;
      assert.equal(found.length, 1);
      const f = found[0];
      assert.equal(f.id, r.id);
      assert.equal(Number(f.number), r.number);
      assert.equal(Number(f.total), r.total);
      assert.equal(f.payment_method, "transferencia");
      assert.equal(f.user_name, "Empleada Uno");
      assert.deepEqual(
        f.items.map((i) => [i.product_name, i.quantity, Number(i.unit_price), Number(i.subtotal)]),
        r.items.map((i) => [i.product_name, i.quantity, i.unit_price, i.subtotal]),
      );
    });
  });

  it("una clave que no existe devuelve cero filas (distinto de un error)", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      assert.equal((await q(FIND, [ID.empleado, K()])).rows.length, 0);
    });
  });

  it("otra cuenta no ve la venta ni siquiera con el identificador del dueño: la RLS lo impide", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await q("reset role");
      await db.exec(`update public.profiles set active = true where user_id = '${ID.inactivo}'`);
      await login(q, ID.inactivo); // otro empleado
      assert.equal((await q(FIND, [ID.empleado, key])).rows.length, 0);
      assert.equal((await q(FIND, [ID.inactivo, key])).rows.length, 0);
    });
  });

  it("la misma clave en dos cuentas son dos ventas distintas, y cada cuenta consulta solo la suya", async () => {
    await asSuper(async (q) => {
      const key = K();
      await login(q, ID.empleado);
      const a = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await login(q, ID.gerente);
      const b = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }], "efectivo", key);
      assert.notEqual(a.id, b.id);
      assert.equal((await q(FIND, [ID.gerente, key])).rows[0].id, b.id);
      await login(q, ID.empleado);
      assert.equal((await q(FIND, [ID.empleado, key])).rows[0].id, a.id);
    });
  });

  it("POR QUÉ la pantalla filtra por la cuenta: un gerente ve las ventas de todos y, sin ese filtro, la clave repetida daría dos filas", async () => {
    await asSuper(async (q) => {
      const key = K();
      await login(q, ID.empleado);
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await login(q, ID.gerente);
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      const sinFiltro = await q("select count(*) n from public.sales where idempotency_key = $1", [key]);
      assert.equal(Number(sinFiltro.rows[0].n), 2, "sin filtrar por cuenta aparecen las dos");
      assert.equal((await q(FIND, [ID.gerente, key])).rows.length, 1, "con el filtro, solo la propia");
    });
  });
});

describe("respuesta perdida y recuperación", () => {
  it("la base registró la venta pero la respuesta se perdió: la consulta la encuentra y reenviar NO duplica nada", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const items = [{ variant_id: VAR.balde, quantity: 2 }, { variant_id: VAR.remeraM, quantity: 1 }];
      await sell(q, items, "credito", key); // la respuesta se descarta: el cliente no llegó a verla

      const before = await counts(q);
      assert.deepEqual(before, { sales: 1, items: 2, movements: 2 });
      await login(q, ID.empleado);
      const found = (await q(FIND, [ID.empleado, key])).rows;
      assert.equal(found.length, 1, "la consulta encuentra la venta");

      const again = await sell(q, items, "credito", key); // reintento con la misma clave
      assert.equal(again.replayed, true);
      assert.equal(again.id, found[0].id);
      assert.deepEqual(await counts(q), before, "ni ventas, ni detalle, ni movimientos nuevos");
      assert.equal(await stockOf(q, VAR.balde), 8);
      assert.equal(await stockOf(q, VAR.remeraM), 4);
      await assertLedger(q);
    });
  });

  it("varios reintentos seguidos con la misma clave: siempre la misma venta", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const first = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      for (let i = 0; i < 5; i++) {
        const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
        assert.equal(r.id, first.id);
        assert.equal(r.replayed, true);
      }
      assert.equal((await counts(q)).sales, 1);
      assert.equal(await stockOf(q, VAR.balde), 9);
    });
  });

  it("la clave no registró nada (el pedido no llegó): la consulta no encuentra nada y el reintento SÍ registra, una vez", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      assert.equal((await q(FIND, [ID.empleado, key])).rows.length, 0);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }], "efectivo", key);
      assert.equal(r.replayed, false);
      assert.deepEqual(await counts(q), { sales: 1, items: 1, movements: 1 });
      await assertLedger(q);
    });
  });

  it("la misma clave con OTRO carrito devuelve la venta original: la pantalla lo detecta comparando total y unidades", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const original = [{ variant_id: VAR.balde, quantity: 1 }];
      const otro = [{ variant_id: VAR.remeraM, quantity: 4 }];
      const a = await sell(q, original, "efectivo", key);
      const b = await sell(q, otro, "credito", key);
      assert.equal(b.id, a.id, "la base no registra la segunda venta");
      assert.equal(b.payment_method, "efectivo");
      await sqlEditor(q);
      assert.equal(await stockOf(q, VAR.remeraM), 5, "el otro carrito no descontó nada");
      assert.equal((await counts(q)).sales, 1);

      // La comprobación de la pantalla, con el comprobante REAL de la base:
      const lines = (items, price) => items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity, unitPrice: price }));
      const asReceipt = { total: b.total, items: b.items.map((i) => ({ quantity: i.quantity })) };
      assert.equal(receiptMatchesAttempt({ lines: lines(original, 1000) }, asReceipt), true, "es la venta del carrito original");
      assert.equal(receiptMatchesAttempt({ lines: lines(otro, 2500) }, asReceipt), false, "no es la venta del otro carrito");
    });
  });
});

describe("límite conocido: una cuenta desactivada no puede resolver su venta pendiente", () => {
  it("si la desactivan después de confirmar, no ve la venta ni puede reenviar; la base la conserva", async () => {
    await asSuper(async (q) => {
      await login(q, ID.inactivo);
      const key = K();
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await sqlEditor(q);
      await q("update public.profiles set active = false where user_id = $1", [ID.inactivo]);
      await login(q, ID.inactivo);
      assert.equal((await q(FIND, [ID.inactivo, key])).rows.length, 0, "no la ve");
      await q.fails(SELL, [key, "efectivo", JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])], "42501");
      assert.equal((await counts(q)).sales, 1, "la venta sigue en la base");
      await assertLedger(q);
    });
  });
});
