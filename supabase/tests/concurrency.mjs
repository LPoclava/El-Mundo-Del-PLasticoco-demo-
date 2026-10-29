// Pruebas de CONCURRENCIA de confirm_sale con un PostgreSQL real y varias conexiones a la vez.
// PGlite tiene una sola conexión y no puede probar esto. Esto levanta un PostgreSQL temporal en
// tu máquina (nada se conecta a Supabase ni a producción) y lo borra al terminar.
//
//   cd supabase/tests
//   npm install --no-save embedded-postgres pg
//   node concurrency.mjs
//
// Requiere descargar los binarios de PostgreSQL (unos 100 MB) la primera vez.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { SUPABASE_STUB, migrationFiles } from "./helpers.mjs";

const { default: EmbeddedPostgres } = await import("embedded-postgres");
const pg = (await import("pg")).default;

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "mp-pg-"));
const PORT = 54999;
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: PORT, persistent: false });

const ID = {
  ceo: "00000000-0000-4000-8000-000000000001",
  a: "00000000-0000-4000-8000-0000000000a1",
  b: "00000000-0000-4000-8000-0000000000a2",
};
const CAT = "10000000-0000-4000-8000-000000000001";
const P = { x: "50000000-0000-4000-8000-0000000000c1", y: "50000000-0000-4000-8000-0000000000c2" };
const V = { x: "60000000-0000-4000-8000-0000000000c1", y: "60000000-0000-4000-8000-0000000000c2" };

const conn = (database) => new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: "postgres", database });
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([name, true]);
    console.log("  ok  ", name);
  } catch (e) {
    results.push([name, false]);
    console.log("  FALLA", name, "->", e.message);
  }
};

/** Una venta en su propia conexión y transacción, como lo haría PostgREST. */
async function sellOn(uid, items, key = crypto.randomUUID(), method = "efectivo") {
  const c = conn("t");
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
    const r = await c.query("select public.confirm_sale($1::uuid, $2, $3::jsonb) as r", [key, method, JSON.stringify(items)]);
    await c.query("commit");
    return { ok: true, sale: r.rows[0].r };
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    return { ok: false, code: e.code, message: e.message };
  } finally {
    await c.end();
  }
}

async function setStock(admin, x, y) {
  await admin.query("update public.product_variants set stock = $2 where id = $1", [V.x, x]);
  await admin.query("update public.product_variants set stock = $2 where id = $1", [V.y, y]);
  await admin.query("delete from public.sale_items");
}

try {
  await server.initialise();
  await server.start();
  await server.createDatabase("t");
  const admin = conn("t");
  await admin.connect();
  await admin.query("create extension if not exists pgcrypto");
  await admin.query(SUPABASE_STUB);
  await admin.query("create extension if not exists unaccent with schema extensions");
  await admin.query("create extension if not exists pg_trgm with schema extensions");
  // Las migraciones pueden intentar crear las extensiones por su cuenta: es idempotente.
  const files = migrationFiles();
  for (const f of files.filter((x) => x < "20261029")) await admin.query(readFileSync(join(HERE, "..", "migrations", f), "utf8"));
  await admin.query("insert into auth.users (id, email) values ($1, 'c@t'), ($2, 'a@t'), ($3, 'b@t')", [ID.ceo, ID.a, ID.b]);
  await admin.query("insert into public.staff (user_id) values ($1)", [ID.ceo]);
  for (const f of files.filter((x) => x >= "20261029")) await admin.query(readFileSync(join(HERE, "..", "migrations", f), "utf8"));
  await admin.query("insert into public.profiles (user_id, display_name, role) values ($1, 'Uno', 'empleado'), ($2, 'Dos', 'empleado')", [ID.a, ID.b]);
  await admin.query("insert into public.categories (id, name, slug) values ($1, 'Cat', 'cat') on conflict do nothing", [CAT]);
  await admin.query("insert into public.products (id, name, category_id) values ($1, 'X', $3), ($2, 'Y', $3)", [P.x, P.y, CAT]);
  await admin.query("insert into public.product_variants (id, product_id, price, stock) values ($1, $3, 100, 0), ($2, $4, 200, 0)", [V.x, V.y, P.x, P.y]);
  await admin.query("alter table public.sales disable trigger sales_no_change"); // solo para limpiar entre pruebas
  const wipe = async () => {
    await admin.query("alter table public.sale_items disable trigger sale_items_no_change");
    await admin.query("alter table public.stock_movements disable trigger stock_movements_no_change");
    await admin.query("delete from public.stock_movements where reason = 'venta'");
    await admin.query("delete from public.sale_items");
    await admin.query("delete from public.sales");
    await admin.query("alter table public.sale_items enable trigger sale_items_no_change");
    await admin.query("alter table public.stock_movements enable trigger stock_movements_no_change");
  };
  const stock = async (id) => Number((await admin.query("select stock from public.product_variants where id = $1", [id])).rows[0].stock);
  const n = async (sql) => Number((await admin.query(sql)).rows[0].n);

  console.log("Concurrencia de confirm_sale (PostgreSQL real, conexiones separadas):");

  await check("12 empleados venden 1 unidad cada uno con stock 5: exactamente 5 ventas, stock 0, nunca negativo", async () => {
    await wipe(); await setStock(admin, 5, 5);
    const out = await Promise.all(Array.from({ length: 12 }, (_, i) => sellOn(i % 2 ? ID.a : ID.b, [{ variant_id: V.x, quantity: 1 }])));
    const ok = out.filter((r) => r.ok).length;
    const rejected = out.filter((r) => !r.ok && r.message === "SALE_REJECTED").length;
    assert.equal(ok, 5, `ventas aceptadas: ${ok}`);
    assert.equal(rejected, 7, JSON.stringify(out.filter((r) => !r.ok && r.message !== "SALE_REJECTED")));
    assert.equal(await stock(V.x), 0);
    assert.equal(await n("select count(*) n from public.sales"), 5);
    assert.equal(await n("select count(*) n from public.stock_movements where reason = 'venta'"), 5);
  });

  await check("dos ventas de 3 unidades con stock 5: solo una se acepta y quedan 2", async () => {
    await wipe(); await setStock(admin, 5, 5);
    const out = await Promise.all([sellOn(ID.a, [{ variant_id: V.x, quantity: 3 }]), sellOn(ID.b, [{ variant_id: V.x, quantity: 3 }])]);
    assert.equal(out.filter((r) => r.ok).length, 1);
    assert.equal(await stock(V.x), 2);
  });

  await check("la misma clave enviada 8 veces a la vez: una sola venta y el stock se descuenta una vez", async () => {
    await wipe(); await setStock(admin, 10, 10);
    const key = crypto.randomUUID();
    const out = await Promise.all(Array.from({ length: 8 }, () => sellOn(ID.a, [{ variant_id: V.x, quantity: 2 }], key)));
    assert.ok(out.every((r) => r.ok), JSON.stringify(out.filter((r) => !r.ok)));
    assert.equal(new Set(out.map((r) => r.sale.id)).size, 1);
    assert.equal(out.filter((r) => !r.sale.replayed).length, 1);
    assert.equal(await n("select count(*) n from public.sales"), 1);
    assert.equal(await stock(V.x), 8);
  });

  await check("ventas con las mismas líneas en orden inverso, en paralelo: sin bloqueos cruzados", async () => {
    await wipe(); await setStock(admin, 100, 100);
    const out = await Promise.all(Array.from({ length: 30 }, (_, i) => sellOn(i % 2 ? ID.a : ID.b,
      i % 2 ? [{ variant_id: V.x, quantity: 1 }, { variant_id: V.y, quantity: 1 }] : [{ variant_id: V.y, quantity: 1 }, { variant_id: V.x, quantity: 1 }])));
    assert.ok(out.every((r) => r.ok), JSON.stringify(out.filter((r) => !r.ok).slice(0, 2)));
    assert.equal(await stock(V.x), 70);
    assert.equal(await stock(V.y), 70);
  });

  await check("una venta de varias líneas con una sin stock, en paralelo con otra válida: nada a medias", async () => {
    await wipe(); await setStock(admin, 10, 1);
    const out = await Promise.all([
      sellOn(ID.a, [{ variant_id: V.x, quantity: 4 }, { variant_id: V.y, quantity: 2 }]), // falla por Y
      sellOn(ID.b, [{ variant_id: V.y, quantity: 1 }]),
    ]);
    assert.equal(out[0].ok, false);
    assert.equal(out[1].ok, true);
    assert.equal(await stock(V.x), 10, "la línea de X de la venta rechazada no descontó");
    assert.equal(await stock(V.y), 0);
  });

  await admin.end();
} catch (e) {
  console.error("No se pudo preparar el PostgreSQL de prueba:", e.message);
  results.push(["preparación", false]);
} finally {
  await server.stop().catch(() => undefined);
  rmSync(dir, { recursive: true, force: true });
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed} de ${results.length} pruebas de concurrencia pasaron.`);
process.exit(failed ? 1 : 0);
