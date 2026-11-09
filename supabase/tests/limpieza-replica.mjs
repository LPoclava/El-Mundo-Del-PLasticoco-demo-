// Valida el script de limpieza PROPUESTO (supabase/limpieza/) en una RÉPLICA LOCAL en memoria (PGlite). No se conecta a Supabase ni toca producción.
// Ejecutar: cd supabase/tests && node limpieza-replica.mjs   (no es *.test.mjs: no corre con npm test)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
const R = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");
const H = await import(pathToFileURL(R + "tests/helpers.mjs").href);
const { ID, CAT1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog } = H;
const SCRIPT = readFileSync(R + "limpieza/20261109_limpieza_produccion.PROPUESTA.sql", "utf8");
const CLOSE = readFileSync(R + "pending/20261029000099_close_drop_staff.sql", "utf8");

const PROD = { med: "a1000000-0000-4000-8000-000000000001", bol: "a1000000-0000-4000-8000-000000000002", pal: "a1000000-0000-4000-8000-000000000003", mer: "a1000000-0000-4000-8000-000000000004", gat: "a1000000-0000-4000-8000-000000000005" };
const VAR = { med: "b1000000-0000-4000-8000-000000000001", bol: "b1000000-0000-4000-8000-000000000002", pal: "b1000000-0000-4000-8000-000000000003", mer: "b1000000-0000-4000-8000-000000000004", gat: "b1000000-0000-4000-8000-000000000005" };
const price = { med: 15000, bol: 4000, pal: 1850, mer: 2500, gat: 7500 };

async function asCeo(db, fn) {
  await db.exec("begin");
  try {
    await db.exec("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.ceo })]);
    const r = await fn((s, p) => db.query(s, p));
    await db.exec("commit");
    return r;
  } catch (e) { await db.exec("rollback"); throw e; }
}

async function build() {
  const db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029" && f < "20261031000001");
  await applyMigrations(db, (f) => f >= "20261031000001");
  await db.exec(CLOSE); // producción ya tiene el cierre aplicado
  await seedCatalog(db); // deja P1 y P2: serán los productos que se CONSERVAN
  for (const k of Object.keys(PROD)) {
    await db.exec(`insert into public.products (id, name, category_id, barcode) values ('${PROD[k]}', 'prueba ${k}', '${CAT1}', '7799${Math.floor(Math.random() * 1e9)}');
                   insert into public.product_variants (id, product_id, price, stock) values ('${VAR[k]}', '${PROD[k]}', ${price[k]}, 0);`);
  }
  const sales = [];
  const sell = (q, k, qty, method) => q("select public.confirm_sale($1::uuid,$2,$3::jsonb) as r", [crypto.randomUUID(), method, JSON.stringify([{ variant_id: VAR[k], quantity: qty }])]);
  await asCeo(db, async (q) => {
    await q("select public.receive_stock($1,200)", [VAR.med]);
    await q("select public.receive_stock($1,100)", [VAR.bol]);
    await q("select public.receive_stock($1,10)", [VAR.gat]);
    await q("select public.adjust_stock($1,2000,'mayos stock')", [VAR.pal]);
    await q("select public.receive_stock($1,100)", [VAR.mer]);
    await sell(q, "bol", 2, "efectivo"); await sell(q, "med", 1, "efectivo"); await sell(q, "med", 2, "efectivo");
    await sell(q, "pal", 15, "credito"); await sell(q, "mer", 2, "efectivo");
  });
  return db;
}

const count = async (db, t) => Number((await db.query(`select count(*)::int as n from ${t}`)).rows[0].n);
async function params(db, { extraEsperado = {} } = {}) {
  const ids = (await db.query("select id from public.sales order by number")).rows.map((r) => r.id);
  const nProd = await count(db, "public.products");
  const nCat = await count(db, "public.categories");
  const nPay = await count(db, "public.payment_methods");
  const audit = await count(db, "public.audit_log");
  const esp = { ventas: 5, detalles: 5, movimientos: 10, suma_total_ventas: 85750, productos_total: nProd, categorias: nCat, medios_pago: nPay, perfiles: 1, audit_log_min: audit, ...extraEsperado };
  const block = `create temp table _lim_ventas (id uuid primary key) on commit drop;
insert into _lim_ventas values ${ids.map((i) => `('${i}')`).join(", ")};
create temp table _lim_productos (id uuid primary key) on commit drop;
insert into _lim_productos values ${Object.values(PROD).map((i) => `('${i}')`).join(", ")};
create temp table _lim_esperado (clave text primary key, valor bigint not null) on commit drop;
insert into _lim_esperado values ${Object.entries(esp).map(([k, v]) => `('${k}', ${v})`).join(", ")};
`;
  return block;
}
const withParams = (block, commit) => {
  const a = SCRIPT.indexOf("-- >>> INICIO DE PARÁMETROS"), b = SCRIPT.indexOf("-- <<< FIN DE PARÁMETROS");
  assert.ok(a > 0 && b > a);
  let s = SCRIPT.slice(0, a) + block + SCRIPT.slice(b);
  if (commit) { assert.ok(s.trimEnd().endsWith("rollback;")); s = s.trimEnd().replace(/rollback;$/, "commit;"); }
  return s;
};
const trig = async (db) => (await db.query(`select tgname, tgenabled from pg_trigger where not tgisinternal and tgname in ('sales_no_change','sale_items_no_change','stock_movements_no_change','sales_no_truncate','sale_items_no_truncate','stock_movements_no_truncate','audit_log_no_change','audit_log_no_truncate') order by 1`)).rows;
const out = [];
const ok = (m) => { out.push("OK   " + m); };

// ---- T0: sin el script, el borrado normal falla (la protección existe) ----
{
  const db = await build();
  for (const sql of ["delete from public.sales", "delete from public.sale_items", "delete from public.stock_movements", "truncate public.sales cascade"]) {
    await db.exec("begin");
    await assert.rejects(() => db.exec(sql), (e) => e.code === "42501", sql);
    await db.exec("rollback");
  }
  ok("T0: delete/truncate sobre sales, sale_items y stock_movements fallan con 42501 incluso como superusuario");
  const before = { s: await count(db, "public.sales"), m: await count(db, "public.stock_movements") };
  assert.deepEqual(before, { s: 5, m: 10 });
  // stock esperado por variante (réplica de producción)
  const st = Object.fromEntries((await db.query("select id, stock from public.product_variants")).rows.map((r) => [r.id, r.stock]));
  assert.equal(st[VAR.med], 197); assert.equal(st[VAR.bol], 98); assert.equal(st[VAR.pal], 1985); assert.equal(st[VAR.mer], 98); assert.equal(st[VAR.gat], 10);
  ok("T0b: la réplica reproduce los stocks de producción (197, 98, 1985, 98, 10)");
}

// ---- T1: simulacro (rollback) ----
{
  const db = await build();
  const block = await params(db);
  const A = { v: await count(db, "public.audit_log") };
  await db.exec(withParams(block, false));
  assert.equal(await count(db, "public.sales"), 5); assert.equal(await count(db, "public.stock_movements"), 10);
  assert.equal(await count(db, "public.products"), 7); assert.equal(await count(db, "public.audit_log"), A.v);
  assert.ok((await trig(db)).every((t) => t.tgenabled === "O"));
  ok("T1: el simulacro termina en ROLLBACK sin dejar nada (ventas 5, movimientos 10, productos 7, triggers habilitados)");
}

// ---- T2: aplicación (commit) ----
{
  const db = await build();
  const block = await params(db);
  const A = await count(db, "public.audit_log");
  const nCatAntes = await count(db, "public.categories"), nPayAntes = await count(db, "public.payment_methods");
  const antes = (await db.query("select id, stock from public.product_variants where product_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002') order by id")).rows;
  await db.exec(withParams(block, true));
  for (const t of ["sales", "sale_items", "stock_movements"]) assert.equal(await count(db, "public." + t), 0, t);
  assert.equal(await count(db, "public.products"), 2);
  assert.equal(await count(db, "public.categories"), nCatAntes); assert.equal(await count(db, "public.payment_methods"), nPayAntes); assert.equal(await count(db, "public.profiles"), 1);
  assert.equal(await count(db, "public.product_variants"), 2);
  const despues = (await db.query("select id, stock from public.product_variants order by id")).rows;
  assert.deepEqual(despues, antes);
  ok("T2a: tras el commit el libro queda vacío; se conservan 2 productos con sus variantes, todas las categorías y medios de pago y el perfil; el stock de lo conservado no cambia");
  const t = await trig(db); assert.equal(t.length, 8); assert.ok(t.every((x) => x.tgenabled === "O"));
  ok("T2b: los 8 triggers de protección quedan habilitados");
  const au = (await db.query("select table_name, operation, source, via from public.audit_log order by id desc limit 20")).rows;
  assert.ok(au.some((r) => r.table_name === "limpieza_produccion" && r.via === "limpieza_produccion_20261109" && r.source === "sql"));
  const dels = (await db.query("select count(*)::int n from public.audit_log where table_name='products' and operation='DELETE'")).rows[0].n;
  assert.equal(dels, 5);
  assert.ok((await count(db, "public.audit_log")) >= A + 5 + 5 + 1);
  ok("T2c: el audit_log no perdió filas y sumó los borrados de productos (5), de variantes y la constancia de la limpieza");
  // No se crean esquemas ni tablas permanentes en la base
  const extra = (await db.query("select count(*)::int n from pg_namespace where nspname like 'limpieza%'")).rows[0].n;
  assert.equal(extra, 0);
  ok("T2d: la limpieza no deja esquemas ni tablas permanentes de respaldo");
  // La numeración NO se reinicia: la próxima venta es la n.º 6 y el próximo movimiento el id 11
  await asCeo(db, async (q) => {
    await q("select public.receive_stock($1,5)", ["30000000-0000-4000-8000-000000000001"]);
    await q("select public.confirm_sale($1::uuid,'efectivo',$2::jsonb)", [crypto.randomUUID(), JSON.stringify([{ variant_id: "30000000-0000-4000-8000-000000000001", quantity: 1 }])]);
  });
  const nv = (await db.query("select number::int n from public.sales")).rows[0].n;
  const nm = (await db.query("select min(id)::int n from public.stock_movements")).rows[0].n;
  assert.equal(nv, 6); assert.equal(nm, 11);
  ok("T2f: la numeración continúa (próxima venta n.º 6, próximo movimiento id 11), sin reutilizar números");
  // La protección sigue vigente después de la limpieza
  await db.exec("begin"); await assert.rejects(() => db.exec("delete from public.sales"), (e) => e.code === "42501"); await db.exec("rollback");
  ok("T2g: después de la limpieza, borrar ventas vuelve a fallar con 42501");
}

// ---- T3: la guarda aborta si el estado cambió (una venta extra) ----
{
  const db = await build();
  const block = await params(db);
  await asCeo(db, async (q) => {
    await q("select public.receive_stock($1,5)", [VAR.gat]);
    await q("select public.confirm_sale($1::uuid,'efectivo',$2::jsonb)", [crypto.randomUUID(), JSON.stringify([{ variant_id: VAR.gat, quantity: 1 }])]);
  });
  await assert.rejects(() => db.exec(withParams(block, true)), /Guarda/);
  await db.exec("rollback");
  assert.equal(await count(db, "public.sales"), 6); assert.equal(await count(db, "public.products"), 7);
  assert.ok((await trig(db)).every((t) => t.tgenabled === "O"));
  ok("T3: con una venta que no estaba en el inventario la guarda aborta, no cambia nada y los triggers siguen habilitados");
}

// ---- T4: una lista de productos incompleta (producto vendido fuera de la lista) también aborta ----
{
  const db = await build();
  let block = await params(db);
  block = block.replace(`('${PROD.med}'), `, "");
  await assert.rejects(() => db.exec(withParams(block, true)), /Guarda/);
  await db.exec("rollback");
  assert.equal(await count(db, "public.sales"), 5);
  ok("T4: si un producto vendido no está en la lista, la guarda aborta y no se toca nada");
}

// ---- T5: la validación posterior deshace todo si algo falla ----
{
  const db = await build();
  let block = await params(db, { extraEsperado: { perfiles: 1, categorias: 99 } }); // fuerza un esperado incorrecto de categorías
  await assert.rejects(() => db.exec(withParams(block, true)), /Guarda|Post/);
  await db.exec("rollback");
  assert.equal(await count(db, "public.sales"), 5);
  assert.ok((await trig(db)).every((t) => t.tgenabled === "O"));
  ok("T5: un esperado incorrecto aborta; todo queda como estaba y los triggers habilitados");
}

console.log(out.join("\n"));
console.log(`\n${out.length} comprobaciones de la réplica pasaron.`);
