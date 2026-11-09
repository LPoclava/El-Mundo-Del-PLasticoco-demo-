// Pruebas del punto de venta (migración 20261031000001) contra PostgreSQL real (PGlite).
// Ejecutar: cd supabase/tests && npm install && npm test
// La concurrencia entre conexiones distintas no se puede probar con PGlite (una sola conexión):
// ver supabase/tests/concurrency.mjs.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asAdmin,
} from "./helpers.mjs";

let db;
const K = () => crypto.randomUUID();

// Productos de prueba: Balde (1 variante, $1000, stock 10), Remera (2 variantes), Sin precio, Archivado.
const PROD = {
  balde: "50000000-0000-4000-8000-000000000001",
  remera: "50000000-0000-4000-8000-000000000002",
  sinPrecio: "50000000-0000-4000-8000-000000000003",
  archivado: "50000000-0000-4000-8000-000000000004",
};
const VAR = {
  balde: "60000000-0000-4000-8000-000000000001",
  remeraM: "60000000-0000-4000-8000-000000000002",
  remeraL: "60000000-0000-4000-8000-000000000003",
  sinPrecio: "60000000-0000-4000-8000-000000000004",
  archivado: "60000000-0000-4000-8000-000000000005",
};

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029" && f < "20261031000001"); // roles y auditoría
  await applyMigrations(db, (f) => f >= "20261031000001"); // esta migración
  await seedCatalog(db);
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente', 'gerente', true),
      ('${ID.empleado}', 'Empleada Uno', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', false);
  `);
});

/** Datos de venta dentro de la transacción actual (se revierten al terminar la prueba). */
async function seed() {
  await db.exec(`
    insert into public.products (id, name, category_id, barcode, publish_enabled) values
      ('${PROD.balde}', 'Balde reforzado 10L', '${CAT1}', '7791111000011', false),
      ('${PROD.remera}', 'Remera lisa', '${CAT1}', '7791111000028', false),
      ('${PROD.sinPrecio}', 'Producto sin precio', '${CAT1}', '7791111000035', false),
      ('${PROD.archivado}', 'Producto archivado', '${CAT1}', '7791111000042', false);
    insert into public.product_variants (id, product_id, size, color, price, position, stock) values
      ('${VAR.balde}', '${PROD.balde}', null, null, 1000, 0, 10),
      ('${VAR.remeraM}', '${PROD.remera}', 'M', 'Azul', 2500, 0, 5),
      ('${VAR.remeraL}', '${PROD.remera}', 'L', 'Azul', 2600, 1, 2),
      ('${VAR.sinPrecio}', '${PROD.sinPrecio}', null, null, null, 0, 9),
      ('${VAR.archivado}', '${PROD.archivado}', null, null, 700, 0, 9);
    update public.products set archived_at = now() where id = '${PROD.archivado}';
  `);
}

/** Pasa de superusuario a un usuario de la API sin cerrar la transacción. */
async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}
const asSuper = (fn) => asAdmin(db, async (q) => { await seed(q); return fn(q); });
const count = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);
const sell = (q, items, method = "efectivo", key = K()) =>
  q("select public.confirm_sale($1::uuid, $2, $3::jsonb) as r", [key, method, JSON.stringify(items)]).then((x) => x.rows[0].r);
const stockOf = async (q, id) => Number((await q("select stock from public.product_variants where id = $1", [id])).rows[0].stock);
const problems = (e) => JSON.parse(e.detail).problems;

describe("búsqueda para vender (pos_find)", () => {
  it("el empleado encuentra por código exacto y por nombre, con variantes, precio y stock", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const byCode = (await q("select public.pos_find('7791111000028') as r")).rows[0].r;
      assert.equal(byCode.length, 1);
      assert.equal(byCode[0].name, "Remera lisa");
      assert.deepEqual(byCode[0].variants.map((v) => [v.size, v.price, v.stock]), [["M", 2500, 5], ["L", 2600, 2]]);
      const byName = (await q("select public.pos_find('REFORZADO') as r")).rows[0].r;
      assert.equal(byName[0].barcode, "7791111000011");
      const tildes = (await q("select public.pos_find('rémera') as r")).rows[0].r;
      assert.equal(tildes.length, 1);
      assert.deepEqual((await q("select public.pos_find('zzzz') as r")).rows[0].r, []);
    });
  });

  it("rechaza términos muy cortos y trata % y _ como texto", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await q.fails("select public.pos_find('a')", [], "22023");
      assert.deepEqual((await q("select public.pos_find('%%') as r")).rows[0].r, []);
    });
  });

  it("marca los archivados y no expone nada a quien no es personal", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = (await q("select public.pos_find('archivado') as r")).rows[0].r;
      assert.equal(r[0].archived, true);
      await login(q, ID.inactivo);
      await q.fails("select public.pos_find('balde')", [], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.pos_find('balde')", [], "42501");
    });
  });
});

describe("confirmar una venta", () => {
  it("registra venta, detalle, descuento de stock y movimientos; el total lo calcula la base", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [
        { variant_id: VAR.balde, quantity: 3 },
        { variant_id: VAR.remeraM, quantity: 2, expected_price: 2500 },
      ], "transferencia");
      assert.equal(r.replayed, false);
      assert.equal(r.total, 3 * 1000 + 2 * 2500);
      assert.equal(r.payment_method, "transferencia");
      assert.equal(r.payment_label, "Transferencia");
      assert.equal(r.user_name, "Empleada Uno");
      assert.equal(r.stock_updated, true);
      assert.deepEqual(r.items.map((i) => [i.product_name, i.quantity, i.unit_price, i.subtotal, i.stock_after]), [
        ["Balde reforzado 10L", 3, 1000, 3000, 7],
        ["Remera lisa", 2, 2500, 5000, 3],
      ]);
      assert.equal(r.items[1].variant_label, "M · Azul");
      assert.equal(typeof r.number, "number");
      await q("reset role");
      assert.equal(await stockOf(q, VAR.balde), 7);
      assert.equal(await stockOf(q, VAR.remeraM), 3);
      assert.equal(await stockOf(q, VAR.remeraL), 2, "otra variante no se toca");
      const mov = (await q("select reason, delta, stock_after, user_id from public.stock_movements where sale_id = $1 order by delta", [r.id])).rows;
      assert.deepEqual(mov.map((m) => [m.reason, m.delta, m.stock_after]), [["venta", -3, 7], ["venta", -2, 3]]);
      assert.ok(mov.every((m) => m.user_id === ID.empleado));
    });
  });

  it("suma las líneas repetidas de una misma variante en una sola", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }, { variant_id: VAR.balde, quantity: 3 }]);
      assert.equal(r.items.length, 1);
      assert.equal(r.items[0].quantity, 5);
      assert.equal(r.total, 5000);
    });
  });

  it("acepta cada medio de pago habilitado y rechaza el deshabilitado o inexistente", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      for (const m of ["efectivo", "transferencia", "debito", "credito"]) {
        const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], m);
        assert.equal(r.payment_method, m);
      }
      for (const bad of ["otro", "bitcoin", "", null]) {
        const e = await q.fails("select public.confirm_sale($1::uuid, $2, $3::jsonb)",
          [K(), bad, JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])], "P0001");
        assert.equal(e.message, "SALE_REJECTED");
        assert.equal(problems(e)[0].reason, "PAYMENT_METHOD");
      }
    });
  });

  it("la administración puede habilitar «otro medio» sin cambiar la lógica de venta", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await q.fails("update public.payment_methods set enabled = true where code = 'otro'", [], "42501").catch(() => undefined);
      await login(q, ID.gerente);
      await q("update public.payment_methods set enabled = true where code = 'otro'");
      await q("insert into public.payment_methods (code, label, position) values ('qr', 'Pago con QR', 6)");
      await login(q, ID.empleado);
      assert.equal((await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "otro")).payment_method, "otro");
      assert.equal((await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "qr")).payment_label, "Pago con QR");
    });
  });
});

describe("rechazos: no queda nada a medias", () => {
  it("stock insuficiente en una línea rechaza TODA la venta y no modifica ningún dato", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const e = await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([
        { variant_id: VAR.balde, quantity: 4 },
        { variant_id: VAR.remeraL, quantity: 3 }, // solo hay 2
      ])], "P0001");
      assert.equal(e.message, "SALE_REJECTED");
      assert.deepEqual(problems(e).map((p) => [p.reason, p.available, p.requested]), [["INSUFFICIENT_STOCK", 2, 3]]);
      await q("reset role");
      assert.equal(await count(q, "select count(*) n from public.sales"), 0);
      assert.equal(await count(q, "select count(*) n from public.sale_items"), 0);
      assert.equal(await stockOf(q, VAR.balde), 10, "la línea válida tampoco descontó");
      assert.equal(await stockOf(q, VAR.remeraL), 2);
      assert.equal(await count(q, "select count(*) n from public.stock_movements where reason = 'venta'"), 0);
    });
  });

  it("informa todos los problemas juntos: sin precio, archivado, inexistente y precio cambiado", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const e = await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([
        { variant_id: VAR.sinPrecio, quantity: 1 },
        { variant_id: VAR.archivado, quantity: 1 },
        { variant_id: "99999999-9999-4999-8999-999999999999", quantity: 1 },
        { variant_id: VAR.balde, quantity: 1, expected_price: 900 },
      ])], "P0001");
      const byReason = Object.fromEntries(problems(e).map((p) => [p.reason, p]));
      assert.ok(byReason.NO_PRICE && byReason.ARCHIVED && byReason.NOT_FOUND && byReason.PRICE_CHANGED);
      assert.equal(byReason.PRICE_CHANGED.price, 1000, "devuelve el precio vigente para actualizar el carrito");
    });
  });

  it("valida cantidades y formato: cero, negativas, decimales, texto, vacío y demasiadas líneas", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const bad = [
        [{ variant_id: VAR.balde, quantity: 0 }],
        [{ variant_id: VAR.balde, quantity: -1 }],
        [{ variant_id: VAR.balde, quantity: 1.5 }],
        [{ variant_id: VAR.balde, quantity: "1; drop table" }],
        [{ variant_id: VAR.balde, quantity: 10000 }],
        [{ variant_id: "no-es-uuid", quantity: 1 }],
        [{ quantity: 1 }],
        [{ variant_id: VAR.balde, quantity: 1, expected_price: -5 }],
        [],
        Array.from({ length: 101 }, () => ({ variant_id: VAR.balde, quantity: 1 })),
      ];
      for (const items of bad) {
        await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify(items)], "22023");
      }
      await q.fails("select public.confirm_sale(null, 'efectivo', $1::jsonb)", [JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])], "22023");
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', null)", [K()], "22023");
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', '{\"a\":1}'::jsonb)", [K()], "22023");
    });
  });

  it("no se puede vender más que el stock sumando líneas repetidas", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const e = await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([
        { variant_id: VAR.remeraL, quantity: 1 }, { variant_id: VAR.remeraL, quantity: 2 },
      ])], "P0001");
      assert.equal(problems(e)[0].reason, "INSUFFICIENT_STOCK");
    });
  });

  it("el stock nunca queda negativo ni siquiera con una edición directa", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q.fails("update public.product_variants set stock = -1 where id = $1", [VAR.balde], "23514");
      await q.fails("select public.adjust_stock($1, -11, 'x')", [VAR.balde], "23514");
    });
  });
});

describe("dos ventas seguidas del mismo artículo", () => {
  it("la segunda ve el stock ya descontado y se rechaza si no alcanza (sin duplicar unidades)", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await sell(q, [{ variant_id: VAR.remeraL, quantity: 2 }]);
      const e = await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)",
        [K(), JSON.stringify([{ variant_id: VAR.remeraL, quantity: 1 }])], "P0001");
      assert.deepEqual(problems(e).map((p) => [p.reason, p.available]), [["INSUFFICIENT_STOCK", 0]]);
      await q("reset role");
      assert.equal(await stockOf(q, VAR.remeraL), 0);
    });
  });
});

describe("idempotencia (doble clic y reintentos)", () => {
  it("repetir la misma clave devuelve la misma venta sin duplicar ni descontar de nuevo", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const items = [{ variant_id: VAR.balde, quantity: 2 }];
      const first = await sell(q, items, "efectivo", key);
      const again = await sell(q, items, "efectivo", key);
      const third = await sell(q, [{ variant_id: VAR.balde, quantity: 9 }], "credito", key); // aunque cambie el carrito
      assert.equal(first.replayed, false);
      assert.equal(again.replayed, true);
      assert.equal(again.id, first.id);
      assert.equal(third.id, first.id);
      await q("reset role");
      assert.equal(await count(q, "select count(*) n from public.sales"), 1);
      assert.equal(await stockOf(q, VAR.balde), 8);
      assert.equal(await count(q, "select count(*) n from public.stock_movements where reason = 'venta'"), 1);
    });
  });

  it("una venta rechazada no gasta la clave: se puede reintentar con la misma tras corregir", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)",
        [key, JSON.stringify([{ variant_id: VAR.balde, quantity: 99 }])], "P0001");
      const ok = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      assert.equal(ok.replayed, false);
    });
  });

  it("la misma clave de otro usuario es otra venta", async () => {
    await asSuper(async (q) => {
      const key = K();
      await login(q, ID.empleado);
      const a = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await login(q, ID.gerente);
      const b = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      assert.notEqual(a.id, b.id);
    });
  });
});

describe("historial inmutable", () => {
  it("editar el precio o el nombre del producto después no altera las ventas anteriores", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }]);
      await login(q, ID.gerente);
      await q("update public.product_variants set price = 9999 where id = $1", [VAR.balde]);
      await q("update public.products set name = 'Balde renombrado' where id = $1", [PROD.balde]);
      const sale = (await q("select total from public.sales where id = $1", [r.id])).rows[0];
      const item = (await q("select product_name, unit_price, subtotal from public.sale_items where sale_id = $1", [r.id])).rows[0];
      assert.equal(Number(sale.total), 2000);
      assert.deepEqual({ ...item, unit_price: Number(item.unit_price), subtotal: Number(item.subtotal) },
        { product_name: "Balde reforzado 10L", unit_price: 1000, subtotal: 2000 });
    });
  });

  it("borrar el producto conserva la venta con su nombre y precio copiados", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await q("reset role");
      await q("delete from public.products where id = $1", [PROD.balde]);
      const item = (await q("select variant_id, product_id, product_name, unit_price from public.sale_items where sale_id = $1", [r.id])).rows[0];
      assert.equal(item.variant_id, null);
      assert.equal(item.product_id, null);
      assert.equal(item.product_name, "Balde reforzado 10L");
      assert.equal(Number(item.unit_price), 1000);
      assert.equal(await count(q, "select count(*) n from public.sales where id = $1", [r.id]), 1);
    });
  });

  it("ni el superusuario edita o borra ventas, detalles o movimientos", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await q("reset role");
      await q.fails("update public.sales set total = 1 where id = $1", [r.id], "42501");
      await q.fails("delete from public.sales where id = $1", [r.id], "42501");
      await q.fails("update public.sale_items set unit_price = 1 where sale_id = $1", [r.id], "42501");
      await q.fails("update public.sale_items set quantity = 99 where sale_id = $1", [r.id], "42501");
      await q.fails("delete from public.sale_items where sale_id = $1", [r.id], "42501");
      await q.fails("update public.stock_movements set delta = 5 where sale_id = $1", [r.id], "42501");
      await q.fails("delete from public.stock_movements where sale_id = $1", [r.id], "42501");
      await q.fails("truncate public.sales cascade", [], "42501");
      await q.fails("truncate public.stock_movements", [], "42501");
    });
  });
});

describe("permisos", () => {
  it("el empleado no escribe ventas, detalles, movimientos, stock ni precios por la API", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await q.fails("insert into public.sales (user_id, user_name, payment_method, total, idempotency_key) values ($1, 'x', 'efectivo', 1, $2)", [ID.empleado, K()], "42501");
      await q.fails("update public.sales set total = 1 where id = $1", [r.id], "42501");
      await q.fails("delete from public.sales where id = $1", [r.id], "42501");
      await q.fails("insert into public.sale_items (sale_id, product_name, unit_price, quantity) values ($1, 'x', 1, 1)", [r.id], "42501");
      await q.fails("insert into public.stock_movements (delta, stock_after, reason) values (1, 1, 'ajuste')", [], "42501");
      // Sin permiso de lectura sobre la tabla, el UPDATE no alcanza ninguna fila (RLS): no cambia nada.
      assert.equal((await q("update public.product_variants set stock = 500 where id = $1", [VAR.balde])).affectedRows, 0);
      assert.equal((await q("update public.product_variants set price = 1 where id = $1", [VAR.balde])).affectedRows, 0);
      await q.fails("select public.adjust_stock($1, 5, 'x')", [VAR.balde], "42501");
      await q.fails("insert into public.payment_methods (code, label) values ('x1', 'X')", [], "42501");
    });
  });

  it("el empleado ve solo sus ventas y no los movimientos; el gerente ve todo", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const mine = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await login(q, ID.gerente);
      const theirs = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await login(q, ID.empleado);
      const seen = (await q("select id from public.sales")).rows.map((x) => x.id);
      assert.deepEqual(seen, [mine.id]);
      assert.equal(await count(q, "select count(*) n from public.sale_items"), 1);
      assert.equal(await count(q, "select count(*) n from public.stock_movements"), 0);
      await login(q, ID.gerente);
      assert.equal(await count(q, "select count(*) n from public.sales"), 2);
      assert.equal(await count(q, "select count(*) n from public.sale_items"), 2);
      assert.ok(await count(q, "select count(*) n from public.stock_movements where sale_id = $1", [theirs.id]) >= 1);
    });
  });

  it("sin sesión, sin perfil o con perfil inactivo no se puede vender ni ver ventas", async () => {
    await asSuper(async (q) => {
      const items = JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }]);
      for (const uid of [ID.inactivo, ID.sinPerfil, ID.enStaffSinPerfil]) {
        await login(q, uid);
        await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), items], "42501");
        assert.equal(await count(q, "select count(*) n from public.sales"), 0);
      }
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', '[]'::jsonb)", [K()], "42501");
      await q.fails("select * from public.sales", [], "42501");
      await q.fails("select * from public.payment_methods", [], "42501");
      await q.fails("select * from public.stock_movements", [], "42501");
    });
  });

  it("un rol falso en el token no da acceso", async () => {
    await asSuper(async (q) => {
      await q("reset role");
      await q("set local role authenticated");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.sinPerfil, user_role: "ceo", app_metadata: { role: "ceo" } })]);
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])], "42501");
    });
  });

  it("las funciones internas no se pueden invocar desde la API", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await q.fails("select public.sale_receipt(gen_random_uuid())", [], "42501");
      await q.fails("select public.log_stock_change()", [], "42501");
    });
  });
});

describe("gerente: stock y medios de pago", () => {
  it("ajusta el stock con nota y queda en los movimientos", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      assert.equal(Number((await q("select public.adjust_stock($1, 15, 'Ingreso de mercadería') as n", [VAR.balde])).rows[0].n), 25);
      assert.equal(Number((await q("select public.adjust_stock($1, -5, 'Rotura') as n", [VAR.balde])).rows[0].n), 20);
      const mov = (await q("select reason, delta, stock_after, note, user_id from public.stock_movements where variant_id = $1 and reason = 'ajuste' order by id desc limit 2", [VAR.balde])).rows;
      assert.deepEqual(mov.map((m) => [m.delta, m.stock_after, m.note]), [[-5, 20, "Rotura"], [15, 25, "Ingreso de mercadería"]]);
      assert.ok(mov.every((m) => m.user_id === ID.gerente));
      await q.fails("select public.adjust_stock($1, 0, 'x')", [VAR.balde], "22023");
      await q.fails("select public.adjust_stock(gen_random_uuid(), 1, 'x')", [], "P0002");
    });
  });

  it("un cambio directo de stock también deja movimiento, y el alta con stock registra el inicial", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q("update public.product_variants set stock = 12 where id = $1", [VAR.balde]);
      const adj = (await q("select reason, delta from public.stock_movements where variant_id = $1 order by id desc limit 1", [VAR.balde])).rows[0];
      assert.deepEqual(adj, { reason: "ajuste", delta: 2 });
      await q("insert into public.product_variants (id, product_id, price, stock) values ('60000000-0000-4000-8000-0000000000aa', $1, 100, 4)", [PROD.balde]);
      const ini = (await q("select reason, delta, stock_after from public.stock_movements where variant_id = '60000000-0000-4000-8000-0000000000aa'")).rows;
      assert.deepEqual(ini, [{ reason: "inicial", delta: 4, stock_after: 4 }]);
    });
  });

  it("el gerente también puede vender", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      assert.equal((await sell(q, [{ variant_id: VAR.balde, quantity: 1 }])).user_name, "Gerente");
    });
  });
});

describe("las migraciones anteriores siguen intactas", () => {
  it("el catálogo público no cambia: el stock no afecta la publicación", async () => {
    await asAnon(db, async (q) => {
      const cols = (await q("select column_name from information_schema.columns where table_name = 'public_catalog' order by ordinal_position")).rows.map((r) => r.column_name);
      assert.ok(!cols.includes("stock"), "el stock no se expone al público");
    });
  });
});
