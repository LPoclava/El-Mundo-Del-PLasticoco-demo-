// Pruebas de la migración 20261102000001 (vistas públicas de la ficha de producto) contra PostgreSQL real.
// Ejecutar: cd supabase/tests && npm install && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { P1, P2, CAT1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asAdmin } from "./helpers.mjs";

const P3 = "20000000-0000-4000-8000-000000000003";
let db;

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029");
  await seedCatalog(db);
  await db.exec(`
    -- P1 suma variantes (una sin precio) y fotos extra. P2 no está publicado (sin foto, deshabilitado).
    insert into public.product_variants (product_id, size, color, price, position) values
      ('${P1}', '20L', 'Rojo', 1800, 1),
      ('${P1}', '30L', null, null, 2);
    insert into public.product_images (product_id, path, is_primary, position) values
      ('${P1}', 'products/p1/b.webp', false, 1),
      ('${P1}', 'products/p1/c.webp', false, 2),
      ('${P2}', 'products/p2/a.webp', true, 0);
    -- P3: completo pero archivado.
    insert into public.products (id, name, category_id, publish_enabled, archived_at) values
      ('${P3}', 'Balde viejo', '${CAT1}', true, now());
    insert into public.product_variants (product_id, price) values ('${P3}', 900);
    insert into public.product_images (product_id, path, is_primary) values ('${P3}', 'products/p3/a.webp', true);
  `);
});

describe("vistas públicas de la ficha", () => {
  it("el visitante ve todas las fotos de un producto publicado", async () => {
    await asAnon(db, async (q) => {
      const r = await q("select path, is_primary from public.public_product_images where product_id = $1 order by position", [P1]);
      assert.deepEqual(r.rows.map((x) => x.path), ["products/p1/a.webp", "products/p1/b.webp", "products/p1/c.webp"]);
      assert.equal(r.rows.filter((x) => x.is_primary).length, 1);
    });
  });

  it("solo ve variantes con precio, sin stock", async () => {
    await asAnon(db, async (q) => {
      const r = await q("select * from public.public_product_variants where product_id = $1 order by position", [P1]);
      assert.deepEqual(r.rows.map((x) => Number(x.price)), [1000, 1800]);
      assert.ok(!("stock" in r.rows[0]), "no expone stock");
      assert.ok(!r.rows.some((x) => x.size === "30L"), "la variante sin precio no aparece");
    });
  });

  it("no expone fotos ni variantes de productos sin publicar o archivados", async () => {
    await asAnon(db, async (q) => {
      for (const id of [P2, P3]) {
        assert.equal((await q("select 1 from public.public_product_images where product_id = $1", [id])).rows.length, 0);
        assert.equal((await q("select 1 from public.public_product_variants where product_id = $1", [id])).rows.length, 0);
        assert.equal((await q("select 1 from public.public_catalog where id = $1", [id])).rows.length, 0);
      }
    });
  });

  it("al despublicar, la ficha deja de tener datos públicos", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.products set publish_enabled = false where id = $1", [P1]);
      await q("set local role anon");
      assert.equal((await q("select 1 from public.public_product_images where product_id = $1", [P1])).rows.length, 0);
      assert.equal((await q("select 1 from public.public_product_variants where product_id = $1", [P1])).rows.length, 0);
    });
  });

  it("el visitante sigue sin acceso a las tablas", async () => {
    for (const table of ["product_variants", "product_images"]) {
      await asAnon(db, async (q) => {
        await assert.rejects(q(`select 1 from public.${table}`), /permission denied/);
      });
    }
  });
});
