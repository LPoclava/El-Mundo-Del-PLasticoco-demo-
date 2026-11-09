// Pruebas de la migración 20261030000001 (categorías principales y banners) contra PostgreSQL real.
// Ejecutar: cd supabase/tests && npm install && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, P1, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asUser, asAdmin,
} from "./helpers.mjs";

const MIGRATION = "20261030000001_main_categories_and_promo_banners.sql";
const IMG = (n) => `banners/${n}.webp`;
let db;

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
      ('${ID.empleado}', 'Empleado', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'gerente', false);
  `);
});

const count = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);

describe("categorías principales", () => {
  it("quedan las cuatro con posición 1 a 4 y slugs estables", async () => {
    await asAdmin(db, async (q) => {
      const r = await q(
        "select slug, name, featured_position from public.categories where featured_position is not null order by featured_position",
      );
      assert.deepEqual(r.rows, [
        { slug: "cocina", name: "Cocina", featured_position: 1 },
        { slug: "bano", name: "Baño", featured_position: 2 },
        { slug: "libreria", name: "Librería", featured_position: 3 },
        { slug: "regaleria", name: "Regalería", featured_position: 4 },
      ]);
    });
  });

  it("no toca las categorías ni los productos que ya existían", async () => {
    await asAdmin(db, async (q) => {
      assert.equal(await count(q, "select count(*) n from public.categories where slug in ('baldes','vasos')"), 2);
      assert.equal(await count(q, "select count(*) n from public.products"), 2);
      assert.equal(await count(q, "select count(*) n from public.categories where featured_position is null"), 2);
    });
  });

  it("reutiliza una categoría existente con el mismo nombre (sin tildes ni mayúsculas) y conserva sus productos", async () => {
    const d = await newDb();
    await applyMigrations(d, (f) => f < "20261029");
    await seedAuthUsersAndStaff(d);
    await applyMigrations(d, (f) => f >= "20261029" && f < MIGRATION);
    await d.exec(`
      insert into public.categories (id, name, slug) values ('10000000-0000-4000-8000-0000000000aa', 'BAÑO', 'sanitarios');
      insert into public.products (id, name, category_id) values
        ('20000000-0000-4000-8000-0000000000aa', 'Cepillo', '10000000-0000-4000-8000-0000000000aa');
    `);
    await applyMigrations(d, (f) => f === MIGRATION);
    const cats = (await d.query("select id, slug, featured_position from public.categories where lower(public.f_unaccent(name)) = 'bano'")).rows;
    assert.equal(cats.length, 1, "no debe duplicar la categoría");
    assert.equal(cats[0].id, "10000000-0000-4000-8000-0000000000aa");
    assert.equal(cats[0].slug, "sanitarios", "conserva su slug");
    assert.equal(cats[0].featured_position, 2);
    assert.equal(Number((await d.query("select count(*) n from public.products where category_id = $1", [cats[0].id])).rows[0].n), 1);
    // Volver a ejecutar el bloque de alta no duplica nada.
    await d.exec(
      (await import("node:fs")).readFileSync(new URL(`../migrations/${MIGRATION}`, import.meta.url), "utf8")
        .match(/do \$\$[\s\S]*?end \$\$;/)[0],
    );
    assert.equal(Number((await d.query("select count(*) n from public.categories where featured_position is not null")).rows[0].n), 4);
  });

  it("subcategorías: un solo nivel, sin ciclos y sin mezclar con las destacadas", async () => {
    await asAdmin(db, async (q) => {
      const cocina = (await q("select id from public.categories where slug = 'cocina'")).rows[0].id;
      await q("insert into public.categories (id, name, slug, parent_id) values ('10000000-0000-4000-8000-0000000000b1', 'Utensilios', 'utensilios', $1)", [cocina]);
      // Una subcategoría no puede tener hijas.
      await q.fails("insert into public.categories (name, slug, parent_id) values ('Cuchillos', 'cuchillos', '10000000-0000-4000-8000-0000000000b1')", [], "23514");
      // Una categoría con hijas no puede volverse hija.
      const bano = (await q("select id from public.categories where slug = 'bano'")).rows[0].id;
      await q.fails("update public.categories set parent_id = $1 where id = $2", [bano, cocina], "23514");
      // No puede ser su propio padre ni destacada siendo hija.
      await q.fails("update public.categories set parent_id = id where slug = 'baldes'", [], "23514");
      await q.fails("update public.categories set featured_position = 1 where slug = 'utensilios'", [], "23514");
    });
  });

  it("no hay dos categorías en la misma posición destacada ni fuera de 1 a 4", async () => {
    await asAdmin(db, async (q) => {
      await q.fails("update public.categories set featured_position = 1 where slug = 'baldes'", [], "23505");
      await q.fails("update public.categories set featured_position = 5 where slug = 'baldes'", [], "23514");
    });
  });

  it("gerente crea subcategorías; empleado no", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const cocina = (await q("select id from public.categories where slug = 'cocina'")).rows[0].id;
      await q("insert into public.categories (name, slug, parent_id) values ('Recipientes', 'recipientes', $1)", [cocina]);
    });
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into public.categories (name, slug) values ('Otra', 'otra')", [], "42501");
    });
  });
});

describe("vistas públicas con jerarquía", () => {
  before(async () => {
    // Producto publicado dentro de una subcategoría de Cocina; Baño queda sin productos.
    await db.exec(`
      insert into public.categories (id, name, slug, parent_id)
        select '10000000-0000-4000-8000-0000000000c1', 'Organizadores', 'organizadores', id
        from public.categories where slug = 'cocina';
      insert into public.products (id, name, category_id, publish_enabled) values
        ('20000000-0000-4000-8000-0000000000c1', 'Organizador', '10000000-0000-4000-8000-0000000000c1', true);
      insert into public.product_variants (product_id, price) values ('20000000-0000-4000-8000-0000000000c1', 900);
      insert into public.product_images (product_id, path, is_primary) values
        ('20000000-0000-4000-8000-0000000000c1', 'products/c1/a.webp', true);
    `);
  });

  it("el producto de una subcategoría expone la categoría principal", async () => {
    await asAnon(db, async (q) => {
      const r = (await q("select category_slug, main_category_slug from public.public_catalog where name = 'Organizador'")).rows[0];
      assert.deepEqual(r, { category_slug: "organizadores", main_category_slug: "cocina" });
      const top = (await q("select category_slug, main_category_slug from public.public_catalog where id = $1", [P1])).rows[0];
      assert.deepEqual(top, { category_slug: "baldes", main_category_slug: "baldes" });
    });
  });

  it("una principal aparece si solo su subcategoría tiene productos publicados; las vacías no", async () => {
    await asAnon(db, async (q) => {
      const slugs = (await q("select slug from public.public_categories order by slug")).rows.map((r) => r.slug);
      assert.ok(slugs.includes("cocina"), "cocina aparece por su subcategoría");
      assert.ok(slugs.includes("organizadores"));
      assert.ok(!slugs.includes("bano"), "baño no tiene productos publicados");
      assert.ok(!slugs.includes("libreria"));
      assert.ok(!slugs.includes("vasos"), "vasos solo tiene un producto sin publicar");
      const sub = (await q("select parent_slug from public.public_categories where slug = 'organizadores'")).rows[0];
      assert.equal(sub.parent_slug, "cocina");
    });
  });

  it("anon sigue sin acceso a las tablas base", async () => {
    await asAnon(db, async (q) => {
      await q.fails("select * from public.categories", [], "42501");
      await q.fails("select * from public.promo_banners", [], "42501");
    });
  });
});

describe("banners promocionales", () => {
  const insert = (q, over = {}) => {
    const b = { image_path: IMG(crypto.randomUUID()), is_active: true, ...over };
    const cols = Object.keys(b);
    return q(
      `insert into public.promo_banners (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`,
      cols.map((c) => b[c]),
    );
  };

  it("gerente y CEO crean, editan y borran; el empleado, el inactivo y anon no", async () => {
    for (const uid of [ID.gerente, ID.ceo2]) {
      await asUser(db, uid, async (q) => {
        const id = (await insert(q, { title: "Combo" })).rows[0].id;
        await q("update public.promo_banners set title = 'Combo 2' where id = $1", [id]);
        await q("delete from public.promo_banners where id = $1", [id]);
      });
    }
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into public.promo_banners (image_path) values ('banners/x.webp')", [], "42501");
    });
    await asUser(db, ID.inactivo, async (q) => {
      await q.fails("insert into public.promo_banners (image_path) values ('banners/x.webp')", [], "42501");
    });
    await asUser(db, ID.sinPerfil, async (q) => {
      await q.fails("insert into public.promo_banners (image_path) values ('banners/x.webp')", [], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("insert into public.promo_banners (image_path) values ('banners/x.webp')", [], "42501");
    });
  });

  it("el empleado no puede leer, modificar ni borrar banners existentes", async () => {
    await asAdmin(db, async (q) => {
      const id = (await insert(q)).rows[0].id;
      await q("set local role authenticated");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.empleado })]);
      assert.equal(await count(q, "select count(*) n from public.promo_banners"), 0);
      await q("update public.promo_banners set title = 'x' where id = $1", [id]);
      await q("delete from public.promo_banners where id = $1", [id]);
      await q("reset role");
      assert.equal(await count(q, "select count(*) n from public.promo_banners where id = $1 and title is null", [id]), 1);
    });
  });

  it("el público ve solo banners activos y dentro de su vigencia", async () => {
    await asAdmin(db, async (q) => {
      await insert(q, { title: "activo" });
      await insert(q, { title: "inactivo", is_active: false });
      await insert(q, { title: "futuro", starts_at: "2999-01-01T00:00:00Z", ends_at: "2999-02-01T00:00:00Z" });
      await insert(q, { title: "vencido", starts_at: "2000-01-01T00:00:00Z", ends_at: "2000-02-01T00:00:00Z" });
      await insert(q, { title: "vigente", starts_at: "2000-01-01T00:00:00Z", ends_at: "2999-01-01T00:00:00Z" });
      await q("set local role anon");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
      const titles = (await q("select title from public.public_promo_banners order by title")).rows.map((r) => r.title);
      assert.deepEqual(titles, ["activo", "vigente"]);
    });
  });

  it("la vista pública no expone fechas, estado ni usuario", async () => {
    await asAnon(db, async (q) => {
      const cols = (await q("select column_name from information_schema.columns where table_name = 'public_promo_banners'")).rows.map((r) => r.column_name);
      for (const c of ["is_active", "starts_at", "ends_at", "updated_by", "created_at"]) assert.ok(!cols.includes(c), c);
    });
  });

  it("rechaza enlaces inseguros y acepta rutas internas y https", async () => {
    await asUser(db, ID.gerente, async (q) => {
      for (const bad of ["javascript:alert(1)", "http://sitio.com", "//evil.com", "/\\evil.com", "data:text/html,x", "https://", "/con espacio", "ftp://x.com"]) {
        await q.fails("insert into public.promo_banners (image_path, link_url) values ($1, $2)", [IMG(crypto.randomUUID()), bad], "23514");
      }
      for (const ok of ["/", "/?categoria=cocina", "/?q=balde&categoria=bano", "https://wa.me/5491112345678"]) {
        await insert(q, { link_url: ok });
      }
    });
  });

  it("valida fechas, largos e imagen", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q.fails("insert into public.promo_banners (image_path, starts_at, ends_at) values ($1, '2030-02-01', '2030-01-01')", [IMG("a1")], "23514");
      await q.fails("insert into public.promo_banners (image_path, starts_at, ends_at) values ($1, '2030-01-01', '2030-01-01')", [IMG("a2")], "23514");
      await q.fails("insert into public.promo_banners (image_path, title) values ($1, repeat('x', 81))", [IMG("a3")], "23514");
      await q.fails("insert into public.promo_banners (image_path, title) values ($1, '   ')", [IMG("a4")], "23514");
      await q.fails("insert into public.promo_banners (image_path) values ('products/a.webp')", [], "23514");
      await q.fails("insert into public.promo_banners (image_path) values ('banners/../x.webp')", [], "23514");
      await q.fails("insert into public.promo_banners (image_path) values (null)", [], "23502");
      // Un archivo no puede pertenecer a dos banners (protege el borrado al reemplazar).
      await q("insert into public.promo_banners (image_path) values ('banners/compartida.webp')");
      await q.fails("insert into public.promo_banners (image_path) values ('banners/compartida.webp')", [], "23505");
    });
  });

  it("los banners nacen inactivos si no se indica otra cosa", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const r = await q("insert into public.promo_banners (image_path) values ($1) returning is_active, updated_by", [IMG("n1")]);
      assert.equal(r.rows[0].is_active, false);
      assert.equal(r.rows[0].updated_by, ID.gerente);
    });
  });

  it("reorder_promo_banners ordena en una operación y exige gerente", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const a = (await insert(q, { title: "A" })).rows[0].id;
      const b = (await insert(q, { title: "B" })).rows[0].id;
      const c = (await insert(q, { title: "C" })).rows[0].id;
      await q("select public.reorder_promo_banners($1::uuid[])", [[c, a, b]]);
      const r = await q("select title from public.promo_banners where id = any($1::uuid[]) order by position", [[a, b, c]]);
      assert.deepEqual(r.rows.map((x) => x.title), ["C", "A", "B"]);
    });
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("select public.reorder_promo_banners($1::uuid[])", [[crypto.randomUUID()]], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.reorder_promo_banners($1::uuid[])", [[crypto.randomUUID()]], "42501");
    });
  });

  it("queda en auditoría con el actor y el rol; el gerente la lee y el empleado no", async () => {
    let id;
    await db.exec("begin");
    try {
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.gerente })]);
      id = (await db.query("insert into public.promo_banners (image_path, title) values ($1, 'Auditado') returning id", [IMG("aud1")])).rows[0].id;
      const mine = (await db.query("select actor_id, actor_role, operation from public.audit_log where table_name = 'promo_banners' and row_id = $1", [id])).rows;
      assert.deepEqual(mine, [{ actor_id: ID.gerente, actor_role: "gerente", operation: "INSERT" }]);
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.empleado })]);
      const other = (await db.query("select count(*) n from public.audit_log where table_name = 'promo_banners'")).rows[0].n;
      assert.equal(Number(other), 0);
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("Storage de banners y categorías", () => {
  const put = (q, name) =>
    q("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [name]);

  it("gerente sube y borra en banners/ y categories/; empleado y anon no", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await put(q, "banners/a.webp");
      await put(q, "categories/cocina.webp");
      await q("delete from storage.objects where name = 'banners/a.webp'");
    });
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'banners/b.webp')", [], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'banners/c.webp')", [], "42501");
    });
  });

  it("el gerente no puede escribir fuera de las carpetas permitidas", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'otra/a.webp')", [], "42501");
    });
  });
});

describe("las migraciones anteriores siguen intactas", () => {
  it("un producto de CAT1 sigue en su categoría original", async () => {
    await asAdmin(db, async (q) => {
      const r = (await q("select category_id from public.products where id = $1", [P1])).rows[0];
      assert.equal(r.category_id, CAT1);
    });
  });
});
