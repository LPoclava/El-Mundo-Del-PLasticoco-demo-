// Prueba de la semilla del proyecto de prueba (supabase/seed-prueba/seed_proyecto_prueba.sql) sobre PostgreSQL real
// (PGlite) con las migraciones del repositorio. Verifica sus protecciones y que lo que crea sirve para probar el POS.
// Ejecutar: cd supabase/tests && npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ID, newDb, applyMigrations, seedAuthUsersAndStaff } from "./helpers.mjs";

const SEED = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "seed-prueba", "seed_proyecto_prueba.sql"), "utf8");
const CONFIRM = "set app.confirmo_proyecto_de_prueba = 'si';";
const V = { balde: "e1e10000-0000-4000-8000-000000000001", remeraL: "e1e10000-0000-4000-8000-000000000003" };

async function freshDb() {
  const db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029");
  await db.exec(`insert into public.profiles (user_id, display_name, role) values
    ('${ID.ceo2}', 'CEO dos', 'ceo'), ('${ID.gerente}', 'Gerente', 'gerente'), ('${ID.empleado}', 'Empleada', 'empleado')`);
  return db;
}
const count = async (db, sql) => Number((await db.query(sql)).rows[0].n);
const asEmployee = (db) =>
  db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${ID.empleado}"}', false);`);

describe("semilla del proyecto de prueba: protecciones", () => {
  it("sin la confirmación explícita no hace nada", async () => {
    const db = await freshDb();
    await assert.rejects(db.exec(SEED), /falta confirmar/);
    assert.equal(await count(db, "select count(*) n from public.products"), 0);
  });

  it("se niega si hay productos que no son de prueba (parece producción) y no agrega nada", async () => {
    const real = await freshDb();
    await real.exec("insert into public.products (name, category_id) values ('Balde de verdad', (select id from public.categories where slug = 'cocina'))");
    await assert.rejects(real.exec(`${CONFIRM}\n${SEED}`), /Parece producción/);
    assert.equal(await count(real, "select count(*) n from public.products"), 1);
  });

  it("se niega si ya hay ventas", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    await asEmployee(db);
    await db.query("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [crypto.randomUUID(), JSON.stringify([{ variant_id: V.balde, quantity: 1 }])]);
    await db.exec("reset role");
    await assert.rejects(db.exec(`${CONFIRM}\n${SEED}`), /ya tiene ventas/);
  });
});

describe("semilla del proyecto de prueba: contenido", () => {
  it("crea cinco productos [PRUEBA] con código de barras de 13 dígitos y seis variantes, y no crea usuarios", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    assert.equal(await count(db, "select count(*) n from public.products where name like '[PRUEBA]%'"), 5);
    assert.equal(await count(db, "select count(*) n from public.products where name not like '[PRUEBA]%'"), 0);
    assert.equal(await count(db, "select count(*) n from public.product_variants"), 6);
    assert.equal(await count(db, "select count(*) n from public.products where barcode ~ '^[0-9]{13}$'"), 5);
    assert.equal(await count(db, "select count(*) n from auth.users"), 7, "los usuarios son los de la prueba: la semilla no crea ninguno");
  });

  it("los códigos de barras tienen dígito verificador EAN-13 correcto (el escáner descarta los que no)", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    const codes = (await db.query("select barcode from public.products order by barcode")).rows.map((r) => r.barcode);
    assert.equal(codes.length, 5);
    for (const c of codes) {
      const digits = [...c].map(Number);
      const sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
      assert.equal(digits[12], (10 - (sum % 10)) % 10, `dígito verificador de ${c}`);
    }
  });

  it("cubre los casos del protocolo: con stock, varias variantes, agotado, sin precio y archivado", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    const v = (await db.query(`select p.name, v.size, v.price, v.stock, p.archived_at is not null as archivado
      from public.product_variants v join public.products p on p.id = v.product_id order by p.name, v.position`)).rows;
    assert.deepEqual(v.map((x) => [x.name, x.size, x.price === null ? null : Number(x.price), x.stock, x.archivado]), [
      ["[PRUEBA] Balde 10 litros", null, 1000, 20, false],
      ["[PRUEBA] Producto agotado", null, 800, 0, false],
      ["[PRUEBA] Producto archivado", null, 700, 9, true],
      ["[PRUEBA] Producto sin precio", null, null, 9, false],
      ["[PRUEBA] Remera lisa", "M", 2500, 10, false],
      ["[PRUEBA] Remera lisa", "L", 2600, 3, false],
    ]);
  });

  it("el stock inicial queda como movimientos «inicial» y el stock cierra con sus movimientos", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    assert.equal(await count(db, "select count(*) n from public.stock_movements where reason = 'inicial'"), 5, "la variante agotada no genera movimiento");
    assert.equal(await count(db, "select count(*) n from public.product_variants v where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0)"), 0);
  });

  it("volver a correrla no duplica nada", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    await db.exec(`${CONFIRM}\n${SEED}`);
    assert.equal(await count(db, "select count(*) n from public.products"), 5);
    assert.equal(await count(db, "select count(*) n from public.product_variants"), 6);
    assert.equal(await count(db, "select count(*) n from public.stock_movements"), 5);
  });

  it("con la semilla se puede buscar por código y vender como empleado, y el stock y el comprobante cierran", async () => {
    const db = await freshDb();
    await db.exec(`${CONFIRM}\n${SEED}`);
    await asEmployee(db);
    const found = (await db.query("select public.pos_find('7799000000020') as r")).rows[0].r;
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "[PRUEBA] Remera lisa");
    assert.equal(found[0].variants.length, 2);
    const r = (await db.query("select public.confirm_sale($1::uuid, 'transferencia', $2::jsonb) as r", [
      crypto.randomUUID(), JSON.stringify([{ variant_id: V.remeraL, quantity: 2, expected_price: 2600 }]),
    ])).rows[0].r;
    assert.equal(r.total, 5200);
    assert.equal(r.items[0].stock_after, 1);
    await db.exec("reset role");
    assert.equal(await count(db, `select stock n from public.product_variants where id = '${V.remeraL}'`), 1);
  });
});
