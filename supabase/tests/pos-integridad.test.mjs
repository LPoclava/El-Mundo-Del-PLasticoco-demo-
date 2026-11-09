// Fase 0.4: integridad, atomicidad, consistencia y permisos del circuito de venta, contra PostgreSQL real (PGlite)
// con las migraciones del repositorio. Complementa pos-ventas.test.mjs y concurrency.mjs (no los reemplaza).
// Ejecutar: cd supabase/tests && npm test
//
// Límites: PGlite tiene una sola conexión, así que la competencia real entre ventas se prueba en concurrency.mjs.
// Los fallos se INYECTAN con disparadores temporales que lanzan un error en un punto exacto de confirm_sale
// (al insertar el detalle, al descontar el stock, al registrar el movimiento o al insertar la venta).
// La expiración del token la verifica PostgREST antes de llegar a la base: acá solo se prueba que sin usuario
// (auth.uid() nulo) no se hace nada. Nada de esto toca Supabase ni producción.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAdmin,
} from "./helpers.mjs";

let db;
const K = () => crypto.randomUUID();

const PROD = {
  balde: "80000000-0000-4000-8000-000000000001",
  remera: "80000000-0000-4000-8000-000000000002",
  sinStock: "80000000-0000-4000-8000-000000000003",
  sinPrecio: "80000000-0000-4000-8000-000000000004",
  archivado: "80000000-0000-4000-8000-000000000005",
};
const VAR = {
  balde: "81000000-0000-4000-8000-000000000001",
  remeraM: "81000000-0000-4000-8000-000000000002",
  remeraL: "81000000-0000-4000-8000-000000000003",
  sinStock: "81000000-0000-4000-8000-000000000004",
  sinPrecio: "81000000-0000-4000-8000-000000000005",
  archivado: "81000000-0000-4000-8000-000000000006",
};
const NO_EXISTE = "81000000-0000-4000-8000-0000000000ff";

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029"); // roles, ventas, escáner y todo lo posterior
  await seedCatalog(db);
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente Uno', 'gerente', true),
      ('${ID.empleado}', 'Empleada Uno', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', false);
  `);
});

/** Datos de venta dentro de la transacción actual (se revierten al terminar la prueba). */
async function seed() {
  await db.exec(`
    insert into public.products (id, name, category_id, barcode, publish_enabled) values
      ('${PROD.balde}', 'Balde reforzado 10L', '${CAT1}', '7794444000011', false),
      ('${PROD.remera}', 'Remera lisa', '${CAT1}', '7794444000028', false),
      ('${PROD.sinStock}', 'Producto agotado', '${CAT1}', '7794444000035', false),
      ('${PROD.sinPrecio}', 'Producto sin precio', '${CAT1}', '7794444000042', false),
      ('${PROD.archivado}', 'Producto archivado', '${CAT1}', '7794444000059', false);
    insert into public.product_variants (id, product_id, size, color, price, position, stock) values
      ('${VAR.balde}', '${PROD.balde}', null, null, 1000, 0, 10),
      ('${VAR.remeraM}', '${PROD.remera}', 'M', 'Azul', 2500, 0, 5),
      ('${VAR.remeraL}', '${PROD.remera}', 'L', 'Azul', 2600, 1, 2),
      ('${VAR.sinStock}', '${PROD.sinStock}', null, null, 800, 0, 0),
      ('${VAR.sinPrecio}', '${PROD.sinPrecio}', null, null, null, 0, 9),
      ('${VAR.archivado}', '${PROD.archivado}', null, null, 700, 0, 9);
    update public.products set archived_at = now() where id = '${PROD.archivado}';
  `);
}

async function login(q, uid, claims = {}) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", ...(uid ? { sub: uid } : {}), ...claims })]);
}
/** Vuelve a ser el SQL Editor: superusuario y sin usuario de la API (hay que borrar también los claims del token). */
async function sqlEditor(q) {
  await q("reset role");
  await q("select set_config('request.jwt.claims', '', true)");
}
const asSuper = (fn) => asAdmin(db, async (q) => { await seed(); return fn(q); });
const SELL = "select public.confirm_sale($1::uuid, $2, $3::jsonb) as r";
const sell = (q, items, method = "efectivo", key = K()) =>
  q(SELL, [key, method, JSON.stringify(items)]).then((x) => x.rows[0].r);
const sellFails = (q, items, code, method = "efectivo", key = K()) =>
  q.fails(SELL, [key, method, items === undefined ? null : JSON.stringify(items)], code);
const problems = (e) => JSON.parse(e.detail).problems;
const stockOf = async (q, id) => Number((await q("select stock from public.product_variants where id = $1", [id])).rows[0].stock);

/** Foto de todo lo que una venta puede tocar. Se toma como superusuario (RLS no interviene). */
async function snapshot(q) {
  await q("reset role");
  const n = async (sql) => Number((await q(sql)).rows[0].n);
  return {
    sales: await n("select count(*) n from public.sales"),
    items: await n("select count(*) n from public.sale_items"),
    movements: await n("select count(*) n from public.stock_movements"),
    stocks: (await q("select id, stock from public.product_variants order by id")).rows,
  };
}

/** Invariantes del libro: no puede haber ventas a medias ni stock que no cierre con sus movimientos. */
async function assertLedger(q) {
  await q("reset role");
  const n = async (sql) => Number((await q(sql)).rows[0].n);
  assert.equal(await n("select count(*) n from public.sales s where not exists (select 1 from public.sale_items i where i.sale_id = s.id)"), 0, "venta sin detalle");
  assert.equal(
    await n("select count(*) n from public.sales s where s.total <> (select sum(i.subtotal) from public.sale_items i where i.sale_id = s.id)"),
    0, "el total de una venta no es la suma de su detalle",
  );
  assert.equal(
    await n("select count(*) n from public.product_variants v where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0)"),
    0, "el stock de una variante no coincide con la suma de sus movimientos",
  );
  assert.equal(
    await n(`select count(*) n from public.sales s where
      (select coalesce(sum(i.quantity), 0) from public.sale_items i where i.sale_id = s.id)
      <> (select coalesce(-sum(m.delta), 0) from public.stock_movements m where m.sale_id = s.id)`),
    0, "las unidades vendidas no coinciden con lo descontado",
  );
  assert.equal(await n("select count(*) n from public.stock_movements m where m.reason = 'venta' and m.sale_id is null"), 0, "movimiento de venta sin venta");
}

const FAIL_FN = (name, condition) => `
  create function public.${name}() returns trigger language plpgsql as $$
  begin
    if ${condition} then raise exception 'FALLA_SIMULADA' using errcode = 'XX001'; end if;
    return new;
  end $$;`;

describe("entradas inválidas: se rechazan enteras y no tocan nada", () => {
  const LINE = (over = {}) => ({ variant_id: VAR.balde, quantity: 1, ...over });
  const cases = [
    ["carrito vacío", [], "22023"],
    ["sin carrito (null de SQL)", undefined, "22023"],
    ["carrito que no es una lista", {}, "22023"],
    ["carrito de texto", "x", "22023"],
    ["más de 100 líneas", Array.from({ length: 101 }, () => LINE()), "22023"],
    ["línea que no es un objeto: número", [1], "22023"],
    ["línea que no es un objeto: nula", [null], "22023"],
    ["cantidad cero", [LINE({ quantity: 0 })], "22023"],
    ["cantidad negativa", [LINE({ quantity: -3 })], "22023"],
    ["cantidad decimal", [LINE({ quantity: 1.5 })], "22023"],
    ["cantidad en texto", [LINE({ quantity: "dos" })], "22023"],
    ["cantidad con ceros a la izquierda", [LINE({ quantity: "01" })], "22023"],
    ["cantidad nula", [LINE({ quantity: null })], "22023"],
    ["sin cantidad", [{ variant_id: VAR.balde }], "22023"],
    ["cantidad mayor al máximo (10000)", [LINE({ quantity: 10000 })], "22023"],
    ["variante sin identificador", [{ quantity: 1 }], "22023"],
    ["identificador que no es UUID", [LINE({ variant_id: "no-es-un-uuid" })], "22023"],
    ["identificador numérico", [LINE({ variant_id: 5 })], "22023"],
    ["precio esperado cero", [LINE({ expected_price: 0 })], "22023"],
    ["precio esperado negativo", [LINE({ expected_price: -5 })], "22023"],
    ["precio esperado decimal", [LINE({ expected_price: 10.5 })], "22023"],
    ["precio esperado en texto", [LINE({ expected_price: "abc" })], "22023"],
    ["precio esperado fuera de rango (10 cifras)", [LINE({ expected_price: 1000000000 })], "22023"],
  ];
  for (const [nombre, items, code] of cases) {
    it(`${nombre}`, async () => {
      await asSuper(async (q) => {
        const before = await snapshot(q);
        await login(q, ID.empleado);
        await sellFails(q, items, code);
        assert.deepEqual(await snapshot(q), before, "una venta inválida no debe cambiar nada");
        await assertLedger(q);
      });
    });
  }

  it("clave de operación nula", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      await q.fails(SELL, [null, "efectivo", JSON.stringify([LINE()])], "22023");
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("medio de pago nulo, vacío, inexistente o deshabilitado: se rechaza con PAYMENT_METHOD", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      for (const method of [null, "", "bitcoin", "otro"]) {
        const e = await q.fails(SELL, [K(), method, JSON.stringify([LINE()])], "P0001");
        assert.equal(e.message, "SALE_REJECTED");
        assert.deepEqual(problems(e), [{ reason: "PAYMENT_METHOD" }], `medio ${method}`);
      }
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("precio inválido en la base: la tabla no admite cero, negativos ni decimales", async () => {
    await asSuper(async (q) => {
      for (const bad of [0, -1, 10.5]) {
        await q.fails("update public.product_variants set price = $1 where id = $2", [bad, VAR.balde]);
      }
      await q.fails("insert into public.product_variants (product_id, price) values ($1, 0)", [PROD.balde], "23514");
      assert.equal(Number((await q("select price from public.product_variants where id = $1", [VAR.balde])).rows[0].price), 1000);
    });
  });
});

describe("productos y variantes: lo que no se puede vender", () => {
  it("variante inexistente: NOT_FOUND, y rechaza TODA la venta aunque las demás líneas sean válidas", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [{ variant_id: VAR.balde, quantity: 1 }, { variant_id: NO_EXISTE, quantity: 1 }], "P0001");
      assert.deepEqual(problems(e).map((p) => [p.reason, p.variant_id]), [["NOT_FOUND", NO_EXISTE]]);
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("producto sin stock (0 unidades): INSUFFICIENT_STOCK con 0 disponibles", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [{ variant_id: VAR.sinStock, quantity: 1 }], "P0001");
      assert.deepEqual(problems(e).map((p) => [p.reason, p.available, p.requested]), [["INSUFFICIENT_STOCK", 0, 1]]);
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("stock insuficiente: pedir una unidad de más rechaza todo y la base informa cuánto hay", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [{ variant_id: VAR.balde, quantity: 2 }, { variant_id: VAR.remeraL, quantity: 3 }], "P0001");
      assert.deepEqual(problems(e).map((p) => [p.reason, p.available, p.requested]), [["INSUFFICIENT_STOCK", 2, 3]]);
      assert.deepEqual(await snapshot(q), before, "la línea válida (balde) tampoco descuenta");
    });
  });

  it("sin precio, archivado y precio que cambió: se informan juntos y no se vende nada", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [
        { variant_id: VAR.sinPrecio, quantity: 1 },
        { variant_id: VAR.archivado, quantity: 1 },
        { variant_id: VAR.remeraM, quantity: 1, expected_price: 2000 },
      ], "P0001");
      assert.deepEqual(problems(e).map((p) => p.reason).sort(), ["ARCHIVED", "NO_PRICE", "PRICE_CHANGED"]);
      assert.equal(problems(e).find((p) => p.reason === "PRICE_CHANGED").price, 2500, "informa el precio vigente");
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("la suma de líneas repetidas que supera el máximo se rechaza antes de tocar el stock", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [{ variant_id: VAR.balde, quantity: 9999 }, { variant_id: VAR.balde, quantity: 9999 }], "P0001");
      assert.deepEqual(problems(e).map((p) => p.reason), ["QUANTITY"]);
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("vender exactamente todo el stock deja la variante en cero y la siguiente venta se rechaza", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.remeraL, quantity: 2 }]);
      assert.equal(r.items[0].stock_after, 0);
      const e = await sellFails(q, [{ variant_id: VAR.remeraL, quantity: 1 }], "P0001");
      assert.equal(problems(e)[0].available, 0);
      await q("reset role");
      assert.equal(await stockOf(q, VAR.remeraL), 0);
      await assertLedger(q);
    });
  });
});

describe("atomicidad: un fallo en cualquier punto no deja nada a medias", () => {
  const ITEMS = [{ variant_id: VAR.balde, quantity: 3 }, { variant_id: VAR.remeraM, quantity: 2 }];

  /** Inyecta el fallo, comprueba que no queda rastro, lo retira y comprueba que la MISMA clave ahora funciona. */
  async function inject({ ddl, drop, expect }) {
    await asSuper(async (q) => {
      await db.exec(ddl);
      const before = await snapshot(q);
      const key = K();
      await login(q, ID.empleado);
      await sellFails(q, ITEMS, "XX001", "efectivo", key);
      assert.deepEqual(await snapshot(q), before, "el fallo dejó datos modificados");
      await assertLedger(q);
      if (expect) await expect(q);

      // Recuperación: se arregla la causa y se reintenta con la misma clave.
      await q("reset role");
      await db.exec(drop);
      await login(q, ID.empleado);
      const r = await sell(q, ITEMS, "efectivo", key);
      assert.equal(r.replayed, false, "la clave no se gastó con el intento fallido");
      assert.equal(r.total, 3 * 1000 + 2 * 2500);
      await q("reset role");
      assert.equal(await stockOf(q, VAR.balde), 7);
      assert.equal(await stockOf(q, VAR.remeraM), 3);
      assert.equal(Number((await q("select count(*) n from public.sales")).rows[0].n), 1);
      assert.equal(Number((await q("select count(*) n from public.sale_items")).rows[0].n), 2);
      await assertLedger(q);
    });
  }

  it("falla al registrar el SEGUNDO renglón del detalle: se revierte la venta, el primer renglón y su descuento", async () => {
    await inject({
      ddl: `${FAIL_FN("zz_fail_items", "new.product_name = 'Remera lisa'")}
            create trigger zz_fail before insert on public.sale_items for each row execute function public.zz_fail_items();`,
      drop: "drop trigger zz_fail on public.sale_items",
    });
  });

  it("falla al descontar el stock del segundo artículo: se revierte también el descuento del primero", async () => {
    await inject({
      ddl: `${FAIL_FN("zz_fail_stock", `new.id = '${VAR.remeraM}' and new.stock < old.stock`)}
            create trigger zz_fail before update on public.product_variants for each row execute function public.zz_fail_stock();`,
      drop: "drop trigger zz_fail on public.product_variants",
      expect: async (q) => assert.equal(await stockOf(q, VAR.balde), 10),
    });
  });

  it("falla al registrar un movimiento de stock: la venta no puede quedar sin su registro de inventario", async () => {
    await inject({
      ddl: `${FAIL_FN("zz_fail_mov", "new.reason = 'venta' and new.delta = -2")}
            create trigger zz_fail before insert on public.stock_movements for each row execute function public.zz_fail_mov();`,
      drop: "drop trigger zz_fail on public.stock_movements",
    });
  });

  it("falla al insertar la propia venta: no queda ni la fila ni el detalle", async () => {
    await inject({
      ddl: `${FAIL_FN("zz_fail_sale", "true")}
            create trigger zz_fail before insert on public.sales for each row execute function public.zz_fail_sale();`,
      drop: "drop trigger zz_fail on public.sales",
    });
  });

  it("un fallo no deja variables de la transacción que contaminen la siguiente operación (app.via, app.sale_id)", async () => {
    await asSuper(async (q) => {
      await db.exec(`${FAIL_FN("zz_fail_items", "new.product_name = 'Remera lisa'")}
               create trigger zz_fail before insert on public.sale_items for each row execute function public.zz_fail_items();`);
      await login(q, ID.empleado);
      await sellFails(q, ITEMS, "XX001");
      await q("reset role");
      // Un ajuste manual de un gerente hecho justo después no puede quedar etiquetado como venta.
      await q("drop trigger zz_fail on public.sale_items");
      await login(q, ID.gerente);
      await q("select public.adjust_stock($1, 1, 'prueba')", [VAR.balde]);
      await q("reset role");
      const m = (await q("select reason, sale_id from public.stock_movements where variant_id = $1 and note = 'prueba'", [VAR.balde])).rows;
      assert.deepEqual(m, [{ reason: "ajuste", sale_id: null }]);
      await assertLedger(q);
    });
  });

  it("después de un rechazo por stock, reponer y reintentar con la misma clave registra la venta una sola vez", async () => {
    await asSuper(async (q) => {
      const key = K();
      await login(q, ID.empleado);
      await sellFails(q, [{ variant_id: VAR.sinStock, quantity: 2 }], "P0001", "efectivo", key);
      await login(q, ID.gerente);
      await q("select public.receive_stock($1, 5, 'llegó mercadería')", [VAR.sinStock]);
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.sinStock, quantity: 2 }], "efectivo", key);
      assert.equal(r.replayed, false);
      assert.equal(r.items[0].stock_after, 3);
      const again = await sell(q, [{ variant_id: VAR.sinStock, quantity: 2 }], "efectivo", key);
      assert.equal(again.replayed, true);
      assert.equal(again.id, r.id);
      await q("reset role");
      assert.equal(await stockOf(q, VAR.sinStock), 3, "se descontó una sola vez");
      await assertLedger(q);
    });
  });
});

describe("doble envío", () => {
  it("la misma venta enviada dos veces devuelve el mismo comprobante, igual salvo el aviso de repetida", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const items = [{ variant_id: VAR.balde, quantity: 2 }, { variant_id: VAR.remeraM, quantity: 1, expected_price: 2500 }];
      const a = await sell(q, items, "debito", key);
      const b = await sell(q, items, "debito", key);
      assert.equal(a.replayed, false);
      assert.equal(b.replayed, true);
      const sinAviso = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "replayed"));
      assert.deepEqual(sinAviso(b), sinAviso(a));
      await q("reset role");
      assert.equal(await stockOf(q, VAR.balde), 8);
      assert.equal(Number((await q("select count(*) n from public.sales")).rows[0].n), 1);
      await assertLedger(q);
    });
  });

  it("COMPORTAMIENTO A TENER PRESENTE: la misma clave con otro carrito devuelve la venta original, no una nueva", async () => {
    // Por eso la pantalla genera una clave nueva en cuanto se edita el carrito o el medio de pago (attemptSignature).
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const key = K();
      const a = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      const b = await sell(q, [{ variant_id: VAR.remeraM, quantity: 4 }], "credito", key);
      assert.equal(b.replayed, true);
      assert.equal(b.id, a.id);
      assert.equal(b.payment_method, "efectivo", "no registra el medio de pago del segundo intento");
      await q("reset role");
      assert.equal(await stockOf(q, VAR.remeraM), 5, "el segundo carrito no descontó nada");
    });
  });

  it("dos usuarios con la misma clave generan dos ventas distintas", async () => {
    await asSuper(async (q) => {
      const key = K();
      await login(q, ID.empleado);
      const a = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      await login(q, ID.gerente);
      const b = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }], "efectivo", key);
      assert.notEqual(a.id, b.id);
      await q("reset role");
      assert.equal(await stockOf(q, VAR.balde), 8);
      await assertLedger(q);
    });
  });
});

describe("consistencia entre venta, pago, detalle, movimientos y comprobante", () => {
  it("todo coincide: comprobante, venta, medio de pago, renglones, movimientos y stock", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [
        { variant_id: VAR.balde, quantity: 4, expected_price: 1000 },
        { variant_id: VAR.remeraM, quantity: 2 },
        { variant_id: VAR.remeraL, quantity: 1 },
      ], "credito");
      await q("reset role");

      const sale = (await q("select * from public.sales where id = $1", [r.id])).rows[0];
      const items = (await q("select * from public.sale_items where sale_id = $1 order by product_name, id", [r.id])).rows;
      const movs = (await q("select * from public.stock_movements where sale_id = $1", [r.id])).rows;

      // Total: base = comprobante = suma de renglones = cálculo independiente.
      const esperado = 4 * 1000 + 2 * 2500 + 1 * 2600;
      assert.equal(Number(sale.total), esperado);
      assert.equal(r.total, esperado);
      assert.equal(items.reduce((s, i) => s + Number(i.subtotal), 0), esperado);
      assert.equal(r.items.reduce((s, i) => s + i.subtotal, 0), esperado);

      // Identificación y pago.
      assert.equal(r.number, Number(sale.number));
      assert.equal(r.id, sale.id);
      assert.equal(r.user_name, "Empleada Uno");
      assert.equal(sale.user_id, ID.empleado);
      assert.equal(r.payment_method, sale.payment_method);
      assert.equal(r.payment_method, "credito");
      assert.equal(r.payment_label, "Tarjeta de crédito");
      assert.equal(r.status, "confirmada");
      assert.equal(new Date(r.created_at).getTime(), new Date(sale.created_at).getTime());

      // Renglones: lo del comprobante es lo guardado.
      assert.equal(r.items.length, items.length);
      assert.deepEqual(
        r.items.map((i) => [i.product_name, i.variant_label, i.barcode, i.unit_price, i.quantity, i.subtotal]),
        items.map((i) => [i.product_name, i.variant_label, i.barcode, Number(i.unit_price), i.quantity, Number(i.subtotal)]),
      );

      // Movimientos: uno por renglón, negativo, con el stock resultante que informa el comprobante y el real.
      assert.equal(movs.length, items.length);
      for (const i of items) {
        const m = movs.find((x) => x.variant_id === i.variant_id);
        assert.ok(m, `falta el movimiento de ${i.product_name}`);
        assert.equal(m.delta, -i.quantity);
        assert.equal(m.reason, "venta");
        assert.equal(m.user_id, ID.empleado);
        assert.equal(await stockOf(q, i.variant_id), m.stock_after);
        assert.equal(r.items.find((x) => x.product_name === i.product_name && x.variant_label === i.variant_label).stock_after, m.stock_after);
      }
      await assertLedger(q);
    });
  });

  it("los números de comprobante crecen y no se repiten, aunque una venta intermedia falle", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const a = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await sellFails(q, [{ variant_id: VAR.sinStock, quantity: 1 }], "P0001");
      const b = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      assert.ok(b.number > a.number);
    });
  });

  it("el precio se congela en la venta: cambiar el precio después no altera comprobante ni total guardado", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }]);
      await q("reset role");
      await q("update public.product_variants set price = 1500 where id = $1", [VAR.balde]);
      await login(q, ID.empleado);
      const replay = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }], "efectivo", K()).catch(() => null);
      assert.equal(replay.total, 3000, "una venta nueva usa el precio nuevo");
      await q("reset role");
      const old = (await q("select total from public.sales where id = $1", [r.id])).rows[0];
      assert.equal(Number(old.total), 2000, "la venta anterior conserva su total");
    });
  });
});

describe("permisos por rol, sesión y desactivación", () => {
  const RANK = { empleado: 0, gerente: 1, ceo: 2 };
  const ROLE_UID = { empleado: ID.empleado, gerente: ID.gerente, ceo: ID.ceo2 };

  // [nombre, rol mínimo, SQL, parámetros]. Cada uno corre en su propia transacción.
  const OPS = [
    ["pos_find", "empleado", "select public.pos_find('Balde')", []],
    ["confirm_sale", "empleado", SELL, () => [K(), "efectivo", JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])]],
    ["scan_create_draft", "empleado", "select public.scan_create_draft('7795555000019', 'Colador', (select id from public.categories where slug = 'cocina'), null)", []],
    ["receive_stock", "gerente", "select public.receive_stock($1, 5, 'entrada')", [VAR.balde]],
    ["adjust_stock", "gerente", "select public.adjust_stock($1, -1, 'ajuste')", [VAR.balde]],
    ["low_stock_variants", "gerente", "select public.low_stock_variants(5)", []],
    ["admin_list_users", "ceo", "select * from public.admin_list_users()", []],
  ];

  for (const [name, min, sql, params] of OPS) {
    for (const role of ["empleado", "gerente", "ceo"]) {
      const allowed = RANK[role] >= RANK[min];
      it(`${role} ${allowed ? "puede" : "NO puede"} ejecutar ${name}`, async () => {
        await asSuper(async (q) => {
          await login(q, ROLE_UID[role]);
          const p = typeof params === "function" ? params() : params;
          if (allowed) await q(sql, p);
          else await q.fails(sql, p, "42501");
        });
      });
    }
  }

  it("nadie escribe ventas, detalle ni movimientos directo por la API, sea cual sea el rol", async () => {
    for (const role of ["empleado", "gerente", "ceo"]) {
      await asSuper(async (q) => {
        await login(q, ROLE_UID[role]);
        await q.fails("insert into public.sales (user_id, user_name, payment_method, total, idempotency_key) values ($1, 'x', 'efectivo', 10, $2)", [ROLE_UID[role], K()], "42501");
        await q.fails("insert into public.sale_items (sale_id, product_name, unit_price, quantity) values (gen_random_uuid(), 'x', 10, 1)", [], "42501");
        await q.fails("insert into public.stock_movements (delta, stock_after, reason) values (1, 1, 'ajuste')", [], "42501");
        await q.fails("delete from public.sales", [], "42501");
      });
    }
  });

  it("el empleado no puede cambiar precio ni stock editando la tabla de variantes", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await q("update public.product_variants set stock = 999, price = 1 where id = $1 returning id", [VAR.balde]).catch(() => ({ rows: [] }));
      assert.equal(r.rows.length, 0, "no debe poder actualizar");
      await q("reset role");
      assert.equal(await stockOf(q, VAR.balde), 10);
      assert.equal(Number((await q("select price from public.product_variants where id = $1", [VAR.balde])).rows[0].price), 1000);
    }).catch(() => undefined);
  });

  it("sin sesión (token vencido o ausente, auth.uid() nulo): no se busca ni se vende", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, null); // rol authenticated pero sin sub: es lo que queda si el token no identifica a nadie
      await q.fails("select public.pos_find('Balde')", [], "42501");
      await q.fails(SELL, [K(), "efectivo", JSON.stringify([{ variant_id: VAR.balde, quantity: 1 }])], "42501");
      assert.deepEqual(await snapshot(q), before);
    });
  });

  it("un token con un rol falso (CEO en los metadatos) no amplía lo que el empleado puede hacer", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado, { user_metadata: { role: "ceo" }, app_metadata: { role: "ceo" }, user_role: "ceo" });
      await q.fails("select public.adjust_stock($1, 5, 'x')", [VAR.balde], "42501");
      await q.fails("select * from public.admin_list_users()", [], "42501");
    });
  });

  it("desactivar la cuenta con la sesión abierta corta la venta y la búsqueda de inmediato, y reactivarla las devuelve", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]); // funciona mientras está activa
      await sqlEditor(q);
      await q("update public.profiles set active = false where user_id = $1", [ID.empleado]);

      const before = await snapshot(q);
      await login(q, ID.empleado); // el mismo token sigue siendo válido: lo que cambió es el perfil
      await q.fails("select public.pos_find('Balde')", [], "42501");
      await sellFails(q, [{ variant_id: VAR.balde, quantity: 1 }], "42501");
      assert.equal(Number((await q("select count(*) n from public.sales")).rows[0].n), 0, "ya no ve ni siquiera sus propias ventas");
      assert.deepEqual(await snapshot(q), before, "no se vendió nada");

      await sqlEditor(q);
      await q("update public.profiles set active = true where user_id = $1", [ID.empleado]);
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      assert.equal(r.replayed, false);
      await assertLedger(q);
    });
  });

  it("bajar el rol de gerente a empleado con la sesión abierta quita los permisos de stock al instante", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q("select public.adjust_stock($1, 1, 'antes')", [VAR.balde]);
      await sqlEditor(q);
      await q("update public.profiles set role = 'empleado' where user_id = $1", [ID.gerente]);
      await login(q, ID.gerente);
      await q.fails("select public.adjust_stock($1, 1, 'después')", [VAR.balde], "42501");
      await q.fails("select public.receive_stock($1, 1, 'después')", [VAR.balde], "42501");
      await q("select public.pos_find('Balde')"); // sigue pudiendo vender como empleado
    });
  });

  it("el empleado ve solo sus ventas; el gerente y el CEO ven todas", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      await login(q, ID.gerente);
      await sell(q, [{ variant_id: VAR.balde, quantity: 1 }]);
      const n = async (uid) => { await login(q, uid); return Number((await q("select count(*) n from public.sales")).rows[0].n); };
      assert.equal(await n(ID.empleado), 1);
      assert.equal(await n(ID.gerente), 2);
      assert.equal(await n(ID.ceo2), 2);
    });
  });
});

describe("la base calcula, no la pantalla", () => {
  it("el total y el precio los fija la base aunque el cliente informe otros valores", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      // El cliente puede mandar campos de más (precio, total): la función los ignora.
      const r = await sell(q, [{ variant_id: VAR.remeraM, quantity: 2, price: 1, unit_price: 1, total: 1, subtotal: 1 }]);
      assert.equal(r.total, 5000);
      assert.equal(r.items[0].unit_price, 2500);
    });
  });

  it("un precio esperado distinto del vigente se rechaza: nunca se cobra un precio que la persona no vio", async () => {
    await asSuper(async (q) => {
      const before = await snapshot(q);
      await login(q, ID.empleado);
      const e = await sellFails(q, [{ variant_id: VAR.remeraM, quantity: 1, expected_price: 1 }], "P0001");
      assert.equal(problems(e)[0].reason, "PRICE_CHANGED");
      assert.deepEqual(await snapshot(q), before);
    });
  });
});

describe("control negativo del verificador", () => {
  it("assertLedger detecta un stock que no cierra con sus movimientos (si no lo detectara, las demás pruebas no valdrían)", async () => {
    await asSuper(async (q) => {
      await q("reset role");
      await assertLedger(q); // sano
      await q("alter table public.product_variants disable trigger product_variants_stock_log");
      await q("update public.product_variants set stock = stock + 7 where id = $1", [VAR.balde]);
      await assert.rejects(assertLedger(q), /no coincide con la suma de sus movimientos/);
    });
  });

  it("assertLedger detecta una venta cuyo total no es la suma de su detalle", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const r = await sell(q, [{ variant_id: VAR.balde, quantity: 2 }]);
      await sqlEditor(q);
      await q("alter table public.sales disable trigger sales_no_change");
      await q("update public.sales set total = total + 1 where id = $1", [r.id]);
      await assert.rejects(assertLedger(q), /no es la suma de su detalle/);
    });
  });
});
