// Pruebas de la migración 20261101000001 (entradas y ajustes de stock, alta rápida, categorías, resúmenes).
// Ejecutar: cd supabase/tests && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asAdmin,
} from "./helpers.mjs";

let db;
const K = () => crypto.randomUUID();
const P = { a: "70000000-0000-4000-8000-000000000001" };
const V = { a: "71000000-0000-4000-8000-000000000001", b: "71000000-0000-4000-8000-000000000002" };

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
      ('${ID.empleado}', 'Empleada', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'gerente', false);
  `);
});

async function seed() {
  await db.exec(`
    insert into public.products (id, name, category_id, barcode) values ('${P.a}', 'Balde', '${CAT1}', '7792222000011');
    insert into public.product_variants (id, product_id, size, price, position, stock) values
      ('${V.a}', '${P.a}', 'Chico', 1000, 0, 10),
      ('${V.b}', '${P.a}', 'Grande', 2000, 1, 3);
  `);
}
async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}
const asSuper = (fn) => asAdmin(db, async (q) => { await seed(); return fn(q); });
const count = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);
const stockOf = async (q, id) => Number((await q("select stock from public.product_variants where id = $1", [id])).rows[0].stock);
const catId = async (q, slug) => (await q("select id from public.categories where slug = $1", [slug])).rows[0].id;

describe("entradas y ajustes de stock", () => {
  it("la entrada suma, deja movimiento de tipo «entrada» con stock anterior y resultante, y no se confunde con una venta", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      const n = Number((await q("select public.receive_stock($1, 5, 'Llegó el pedido') as n", [V.a])).rows[0].n);
      assert.equal(n, 15);
      const m = (await q("select reason, delta, stock_before, stock_after, note, user_id, sale_id, created_at is not null as fecha from public.stock_movements where variant_id = $1 and reason = 'entrada'", [V.a])).rows;
      assert.deepEqual(m, [{ reason: "entrada", delta: 5, stock_before: 10, stock_after: 15, note: "Llegó el pedido", user_id: ID.gerente, sale_id: null, fecha: true }]);
      assert.equal(await count(q, "select count(*) n from public.stock_movements where variant_id = $1 and reason = 'venta'", [V.a]), 0);
    });
  });

  it("el ajuste exige motivo, acepta restar y registra el tipo «ajuste»", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q.fails("select public.adjust_stock($1, -2, null)", [V.a], "22023");
      await q.fails("select public.adjust_stock($1, -2, '   ')", [V.a], "22023");
      assert.equal(Number((await q("select public.adjust_stock($1, -2, 'Rotura') as n", [V.a])).rows[0].n), 8);
      const m = (await q("select reason, delta, stock_before, stock_after, note from public.stock_movements where variant_id = $1 and reason = 'ajuste'", [V.a])).rows;
      assert.deepEqual(m, [{ reason: "ajuste", delta: -2, stock_before: 10, stock_after: 8, note: "Rotura" }]);
    });
  });

  it("valida cantidades y nunca deja el stock negativo", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      for (const bad of [0, -1, 1000001]) await q.fails("select public.receive_stock($1, $2, 'x')", [V.a, bad], "22023");
      await q.fails("select public.receive_stock($1, 1.5, 'x')", [V.a], "22P02").catch(() => undefined);
      await q.fails("select public.adjust_stock($1, -11, 'Ajuste')", [V.a], "23514");
      await q.fails("select public.receive_stock(gen_random_uuid(), 1, 'x')", [], "P0002");
      assert.equal(await stockOf(q, V.a), 10);
    });
  });

  it("el empleado, el inactivo, sin perfil y anónimo no pueden mover stock", async () => {
    await asSuper(async (q) => {
      for (const uid of [ID.empleado, ID.inactivo, ID.sinPerfil]) {
        await login(q, uid);
        await q.fails("select public.receive_stock($1, 5, 'x')", [V.a], "42501");
        await q.fails("select public.adjust_stock($1, 5, 'x')", [V.a], "42501");
      }
      await q("reset role");
      assert.equal(await stockOf(q, V.a), 10);
      assert.equal(await count(q, "select count(*) n from public.stock_movements where variant_id = $1 and reason in ('entrada','ajuste')", [V.a]), 0);
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.receive_stock($1, 5, 'x')", [V.a], "42501");
    });
  });

  it("el empleado no puede cambiar el stock ni por edición directa de la tabla", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      assert.equal((await q("update public.product_variants set stock = 999 where id = $1", [V.a])).affectedRows, 0);
      await q("reset role");
      assert.equal(await stockOf(q, V.a), 10);
    });
  });

  it("los movimientos siguen siendo de solo agregado y sobreviven al borrado del producto", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q("select public.receive_stock($1, 5, 'x')", [V.a]);
      await q("reset role");
      await q.fails("update public.stock_movements set delta = 1 where variant_id = $1", [V.a], "42501");
      await q.fails("delete from public.stock_movements where variant_id = $1", [V.a], "42501");
      await q("delete from public.products where id = $1", [P.a]);
      const kept = await count(q, "select count(*) n from public.stock_movements where variant_id is null and stock_after = 15");
      assert.equal(kept, 1);
    });
  });
});

describe("alta rápida de un producto incompleto", () => {
  it("el empleado lo crea sin publicar y sin variantes, con creador y descripción", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const cocina = await catId(q, "cocina");
      const id = (await q("select public.scan_create_draft('7793333000010', '  Colador  ', $1, 'Colador de acero') as id", [cocina])).rows[0].id;
      await q("reset role");
      const p = (await q("select name, description, publish_enabled, created_by, barcode, category_id from public.products where id = $1", [id])).rows[0];
      assert.deepEqual(p, { name: "Colador", description: "Colador de acero", publish_enabled: false, created_by: ID.empleado, barcode: "7793333000010", category_id: cocina });
      assert.equal(await count(q, "select count(*) n from public.product_variants where product_id = $1", [id]), 0);
    });
  });

  it("no se puede vender, ni mover stock, ni se ve en el catálogo público", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const cocina = await catId(q, "cocina");
      await q("select public.scan_create_draft('7793333000010', 'Colador', $1)", [cocina]);
      const found = (await q("select public.pos_find('7793333000010') as r")).rows[0].r;
      assert.equal(found[0].name, "Colador");
      assert.deepEqual(found[0].variants, []);
      await q.fails("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([{ variant_id: "99999999-9999-4999-8999-999999999999", quantity: 1 }])], "P0001");
      await login(q, ID.gerente);
      await q.fails("select public.receive_stock(gen_random_uuid(), 1, 'x')", [], "P0002");
      await q("reset role");
      await q("set local role anon");
      await q("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      assert.equal(await count(q, "select count(*) n from public.public_catalog where name = 'Colador'"), 0);
    });
  });

  it("rechaza códigos duplicados o inválidos, nombres vacíos y categorías secundarias o inexistentes", async () => {
    await asSuper(async (q) => {
      await login(q, ID.empleado);
      const cocina = await catId(q, "cocina");
      await q("select public.scan_create_draft('7793333000010', 'Colador', $1)", [cocina]);
      await q.fails("select public.scan_create_draft('7793333000010', 'Otro', $1)", [cocina], "23505");
      await q.fails("select public.scan_create_draft('7792222000011', 'Repetido de otro', $1)", [cocina], "23505");
      await q.fails("select public.scan_create_draft('123', 'Corto', $1)", [cocina], "22023");
      await q.fails("select public.scan_create_draft('7793333000027', '   ', $1)", [cocina], "22023");
      await q.fails("select public.scan_create_draft('7793333000027', repeat('x', 201), $1)", [cocina], "22023");
      await q.fails("select public.scan_create_draft('7793333000027', 'Ok', gen_random_uuid())", [], "22023");
      await q("reset role");
      await q("insert into public.categories (id, name, slug, parent_id) values ('72000000-0000-4000-8000-000000000001', 'Sub', 'sub', $1)", [cocina]);
      await login(q, ID.empleado);
      await q.fails("select public.scan_create_draft('7793333000027', 'Ok', '72000000-0000-4000-8000-000000000001')", [], "22023");
    });
  });

  it("sin sesión o con perfil inactivo no se puede registrar", async () => {
    await asSuper(async (q) => {
      const cocina = await catId(q, "cocina");
      await login(q, ID.inactivo);
      await q.fails("select public.scan_create_draft('7793333000010', 'Colador', $1)", [cocina], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.scan_create_draft('7793333000010', 'Colador', gen_random_uuid())", [], "42501");
    });
  });

  it("pos_find devuelve la descripción", async () => {
    await asSuper(async (q) => {
      await q("update public.products set description = 'Con asa' where id = $1", [P.a]);
      await login(q, ID.empleado);
      assert.equal((await q("select public.pos_find('7792222000011') as r")).rows[0].r[0].description, "Con asa");
    });
  });
});

describe("categorías principales", () => {
  it("el gerente edita nombre, descripción y estado; el empleado no", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      await q("update public.categories set name = 'Cocina y hogar', description = 'Para la cocina' where slug = 'cocina'");
      const c = (await q("select name, description, slug, active from public.categories where slug = 'cocina'")).rows[0];
      assert.deepEqual(c, { name: "Cocina y hogar", description: "Para la cocina", slug: "cocina", active: true });
      await q.fails("update public.categories set description = repeat('x', 201) where slug = 'cocina'", [], "23514");
      await login(q, ID.empleado);
      assert.equal((await q("update public.categories set active = false where slug = 'cocina'")).affectedRows, 0);
    });
  });

  it("una categoría desactivada deja de aparecer en el acceso público sin tocar los productos", async () => {
    await asSuper(async (q) => {
      const cocina = await catId(q, "cocina");
      await q("update public.products set category_id = $1, publish_enabled = true where id = $2", [cocina, P.a]);
      await q("insert into public.product_images (product_id, path, is_primary) values ($1, 'products/a.webp', true)", [P.a]);
      await q("set local role anon");
      await q("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      assert.equal(await count(q, "select count(*) n from public.public_categories where slug = 'cocina'"), 1);
      await q("reset role");
      await q("update public.categories set active = false where slug = 'cocina'");
      await q("set local role anon");
      await q("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      assert.equal(await count(q, "select count(*) n from public.public_categories where slug = 'cocina'"), 0);
      assert.equal(await count(q, "select count(*) n from public.public_catalog where name = 'Balde'"), 1, "el producto sigue en el catálogo");
    });
  });

  it("reordena las cuatro de una vez y rechaza listas incompletas o ajenas", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      const ids = (await q("select id from public.categories where featured_position is not null order by featured_position")).rows.map((r) => r.id);
      assert.equal(ids.length, 4);
      await q("select public.reorder_main_categories($1::uuid[])", [[ids[3], ids[2], ids[1], ids[0]]]);
      const slugs = (await q("select slug from public.categories where featured_position is not null order by featured_position")).rows.map((r) => r.slug);
      assert.deepEqual(slugs, ["regaleria", "libreria", "bano", "cocina"]);
      await q.fails("select public.reorder_main_categories($1::uuid[])", [[ids[0], ids[1]]], "22023");
      await q.fails("select public.reorder_main_categories($1::uuid[])", [[ids[0], ids[1], ids[2], CAT1]], "22023");
      await login(q, ID.empleado);
      await q.fails("select public.reorder_main_categories($1::uuid[])", [ids], "42501");
    });
  });

  it("no elimina categorías con productos sin reasignar ni con subcategorías; reasigna y elimina de una vez", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      const regal = await catId(q, "regaleria");
      const bano = await catId(q, "bano");
      await q("reset role");
      await q("update public.products set category_id = $1 where id = $2", [regal, P.a]);
      await q("insert into public.categories (name, slug, parent_id) values ('Moños', 'monos', $1)", [regal]);
      await login(q, ID.gerente);
      await q.fails("select public.delete_category_safe($1)", [regal], "23503"); // tiene subcategorías
      await q("reset role");
      await q("delete from public.categories where slug = 'monos'");
      await login(q, ID.gerente);
      await q.fails("select public.delete_category_safe($1)", [regal], "23503"); // tiene productos
      await q.fails("select public.delete_category_safe($1, $1)", [regal], "23503");
      await q.fails("select public.delete_category_safe($1, gen_random_uuid())", [regal], "23503");
      assert.equal(await count(q, "select count(*) n from public.categories where id = $1", [regal]), 1);
      const moved = Number((await q("select public.delete_category_safe($1, $2) as n", [regal, bano])).rows[0].n);
      assert.equal(moved, 1);
      assert.equal(await count(q, "select count(*) n from public.categories where id = $1", [regal]), 0);
      assert.equal((await q("select category_id from public.products where id = $1", [P.a])).rows[0].category_id, bano);
      await login(q, ID.empleado);
      await q.fails("select public.delete_category_safe($1)", [bano], "42501");
    });
  });

  it("una categoría vacía se elimina sin pedir reasignación", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      const libreria = await catId(q, "libreria");
      assert.equal(Number((await q("select public.delete_category_safe($1) as n", [libreria])).rows[0].n), 0);
    });
  });
});

describe("resúmenes del inicio", () => {
  async function sell(q, uid, items) {
    await login(q, uid);
    return (await q("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb) as r", [K(), JSON.stringify(items)])).rows[0].r;
  }

  it("cuenta ventas, facturación y unidades; el empleado ve solo las suyas y el gerente todas", async () => {
    await asSuper(async (q) => {
      await sell(q, ID.empleado, [{ variant_id: V.a, quantity: 2 }]); // 2000
      await sell(q, ID.gerente, [{ variant_id: V.b, quantity: 1 }, { variant_id: V.a, quantity: 1 }]); // 3000
      const range = ["2000-01-01T00:00:00Z", "2999-01-01T00:00:00Z"];
      await login(q, ID.empleado);
      const emp = (await q("select public.sales_summary($1, $2) as r", range)).rows[0].r;
      assert.deepEqual([emp.sales_count, emp.revenue, emp.units], [1, 2000, 2]);
      await login(q, ID.gerente);
      const all = (await q("select public.sales_summary($1, $2) as r", range)).rows[0].r;
      assert.deepEqual([all.sales_count, all.revenue, all.units], [2, 5000, 4]);
      assert.deepEqual(all.top_products.map((t) => [t.name, t.variant, t.units]), [["Balde", "Chico", 3], ["Balde", "Grande", 1]]);
      const vacio = (await q("select public.sales_summary('2000-01-01', '2000-01-02') as r")).rows[0].r;
      assert.deepEqual([vacio.sales_count, vacio.revenue, vacio.units, vacio.top_products], [0, 0, 0, []]);
    });
  });

  it("stock bajo: solo gerente o superior, con umbral y sin archivados", async () => {
    await asSuper(async (q) => {
      await login(q, ID.gerente);
      const low = (await q("select public.low_stock_variants(5) as r")).rows[0].r;
      assert.deepEqual(low.map((x) => [x.name, x.variant, x.stock]).filter((x) => x[0] === "Balde"), [["Balde", "Grande", 3]]);
      const all = (await q("select public.low_stock_variants(100) as r")).rows[0].r;
      assert.ok(all.length >= 2);
      await login(q, ID.empleado);
      await q.fails("select public.low_stock_variants(5)", [], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.sales_summary(now(), now())", [], "42501");
    });
  });
});
