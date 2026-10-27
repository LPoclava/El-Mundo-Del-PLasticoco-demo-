// Pruebas de autorización contra PostgreSQL real con las migraciones del repositorio.
// Ejecutar: cd supabase/tests && npm install && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, P1, P2, V1, V2, CAT1, CAT2,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asUser, asAdmin,
} from "./helpers.mjs";

const NEW_CODE = "7790009999990";
let db;

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029"); // lo que ya hay en producción
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029"); // esta tanda
  await seedCatalog(db);
  // Equipo de prueba, dado de alta como lo haría el SQL Editor.
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente', 'gerente', true),
      ('${ID.empleado}', 'Empleado', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', false);
  `);
});

const count = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);

describe("migración desde public.staff", () => {
  it("la cuenta de staff queda como CEO activo y staff queda como staff_legacy", async () => {
    await asAdmin(db, async (q) => {
      const r = (await q("select role, active from public.profiles where user_id = $1", [ID.ceo])).rows[0];
      assert.deepEqual(r, { role: "ceo", active: true });
      assert.equal((await q("select to_regclass('public.staff')")).rows[0].to_regclass, null);
      assert.ok((await q("select to_regclass('public.staff_legacy')")).rows[0].to_regclass);
      assert.equal(await count(q, "select count(*) n from public.staff_legacy"), 1);
    });
  });

  it("is_staff() ya no se puede invocar desde la API", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q.fails("select public.is_staff()", [], "42501");
    });
  });

  it("no queda ninguna política que dependa de is_staff()", async () => {
    await asAdmin(db, async (q) => {
      const r = await q(`select count(*) n from pg_policies
        where qual ilike '%is_staff%' or with_check ilike '%is_staff%'`);
      assert.equal(Number(r.rows[0].n), 0);
      const f = await q(`select count(*) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and p.proname <> 'is_staff' and pg_get_functiondef(p.oid) ilike '%is_staff%'`);
      assert.equal(Number(f.rows[0].n), 0);
    });
  });
});

describe("público (anon)", () => {
  it("no escribe ni lee tablas protegidas, perfiles ni auditoría", async () => {
    await asAnon(db, async (q) => {
      for (const t of ["products", "product_variants", "product_images", "categories", "profiles", "audit_log"]) {
        await q.fails(`select * from public.${t}`, [], "42501");
      }
      await q.fails("insert into public.products (name, category_id) values ('x', $1)", [CAT1], "42501");
      await q.fails("update public.products set name = 'x'", [], "42501");
      await q.fails("delete from public.product_images", [], "42501");
      await q.fails("update public.profiles set role = 'ceo'", [], "42501");
    });
  });

  it("no modifica imágenes en Storage", async () => {
    await asAnon(db, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/y.webp')", [], "42501");
      assert.equal(await count(q, "select count(*) n from storage.objects"), 0);
    });
  });

  it("no invoca funciones de administración ni de escaneo", async () => {
    await asAnon(db, async (q) => {
      await q.fails("select public.scan_lookup('7790001000011')", [], "42501");
      await q.fails("select public.admin_set_role($1, 'ceo')", [ID.empleado], "42501");
    });
  });
});

describe("usuario sin perfil, inactivo o con rol falso en el token", () => {
  for (const [nombre, uid, claims] of [
    ["sin perfil", ID.sinPerfil, {}],
    ["inactivo", ID.inactivo, {}],
    ["sin perfil con user_metadata.role = ceo", ID.sinPerfil, { user_metadata: { role: "ceo" }, app_metadata: { role: "ceo" } }],
    ["en staff_legacy pero sin perfil", ID.enStaffSinPerfil, {}],
  ]) {
    it(`${nombre}: no accede a nada protegido`, async () => {
      await asUser(db, uid, async (q) => {
        assert.equal(await count(q, "select count(*) n from public.products"), 0);
        assert.equal(await count(q, "select count(*) n from public.categories"), 0);
        assert.equal(await count(q, "select count(*) n from public.audit_log"), 0);
        await q.fails("insert into public.categories (name, slug) values ('X', 'x')", [], "42501");
        await q.fails("select public.scan_lookup('7790001000011')", [], "42501");
        await q.fails("select public.scan_set_price($1, 10)", [V1], "42501");
        await q.fails("select public.admin_set_role($1, 'ceo')", [uid], "42501");
        await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/y.webp')", [], "42501");
      }, claims);
    });
  }
});

describe("empleado", () => {
  it("consulta un producto por código, incluso no publicado, solo vía scan_lookup", async () => {
    await asUser(db, ID.empleado, async (q) => {
      const r = (await q("select public.scan_lookup('7790001000028') as r")).rows[0].r;
      assert.equal(r.name, "Vaso largo");
      assert.equal(r.published, false);
      assert.equal(r.variants[0].price, 500);
      assert.equal((await q("select public.scan_lookup('7790000000000') as r")).rows[0].r, null);
      await q.fails("select public.scan_lookup('abc')", [], "22023");
      // Sin lectura directa de productos ni variantes.
      assert.equal(await count(q, "select count(*) n from public.products"), 0);
      assert.equal(await count(q, "select count(*) n from public.product_variants"), 0);
    });
  });

  it("cambia el precio y solo el precio", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_set_price($1, 1500)", [V1]);
      await q.fails("select public.scan_set_price($1, 0)", [V1], "22023");
      await q.fails("select public.scan_set_price($1, -5)", [V1], "22023");
      await q.fails("select public.scan_set_price('99999999-0000-4000-8000-000000000000', 10)", [], "P0002");
      const a = (await q(`select actor_id, actor_role, operation, changed_fields, via, source,
          (old_data->>'price')::int old_price, (new_data->>'price')::int new_price
        from public.audit_log where table_name = 'product_variants' and row_id = $1 and actor_id = $2`, [V1, ID.empleado])).rows;
      assert.equal(a.length, 1);
      assert.deepEqual(a[0], {
        actor_id: ID.empleado, actor_role: "empleado", operation: "UPDATE",
        changed_fields: ["price"], via: "scan_set_price", source: "api", old_price: 1000, new_price: 1500,
      });
    });
  });

  it("vincula y corrige códigos; rechaza duplicados y formato inválido", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_link_barcode($1, $2)", [P2, NEW_CODE]);
      await q("select public.scan_link_barcode($1, $2)", [P2, NEW_CODE]); // repetir el mismo no falla
      await q.fails("select public.scan_link_barcode($1, '7790001000011')", [P2], "23505"); // es de P1
      await q.fails("select public.scan_link_barcode($1, '123')", [P2], "22023");
      await q.fails("select public.scan_link_barcode($1, null)", [P2], "22023");
      const a = (await q(`select changed_fields from public.audit_log
        where table_name = 'products' and row_id = $1 and actor_id = $2`, [P2, ID.empleado])).rows;
      assert.deepEqual(a.map((r) => r.changed_fields), [["barcode"]]);
    });
  });

  it("crea un producto desde el escáner: sin publicar, sin fotos, auditado", async () => {
    await asUser(db, ID.empleado, async (q) => {
      const id = (await q("select public.scan_create_product($1, '  Taza  ', $2, 800, ' Marca ') as id", [NEW_CODE, CAT1])).rows[0].id;
      const p = (await q("select public.scan_lookup($1) as r", [NEW_CODE])).rows[0].r;
      assert.equal(p.product_id, id);
      assert.equal(p.name, "Taza");
      assert.equal(p.brand, "Marca");
      assert.equal(p.published, false);
      assert.equal(p.variants[0].price, 800);
      const logs = (await q(`select table_name, operation, via from public.audit_log
        where actor_id = $1 order by id`, [ID.empleado])).rows;
      assert.deepEqual(logs, [
        { table_name: "products", operation: "INSERT", via: "scan_create_product" },
        { table_name: "product_variants", operation: "INSERT", via: "scan_create_product" },
      ]);
    });
  });

  it("el producto del escáner nunca aparece en el catálogo público", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_create_product($1, 'Taza', $2, 800)", [NEW_CODE, CAT1]);
      assert.equal(await count(q, "select count(*) n from public.public_catalog where name = 'Taza'"), 0);
    });
  });

  it("rechaza datos inválidos al crear y códigos ya existentes", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("select public.scan_create_product('7790001000011', 'Otro', $1, 10)", [CAT1], "23505");
      await q.fails("select public.scan_create_product($1, '   ', $2, 10)", [NEW_CODE, CAT1], "22023");
      await q.fails("select public.scan_create_product($1, 'X', $2, 0)", [NEW_CODE, CAT1], "22023");
      await q.fails("select public.scan_create_product($1, 'X', '99999999-0000-4000-8000-000000000000', 10)", [NEW_CODE], "22023");
      await q.fails("select public.scan_create_product('12', 'X', $1, 10)", [CAT1], "22023");
    });
  });

  it("segunda creación con el mismo código se rechaza", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_create_product($1, 'Uno', $2, 10)", [NEW_CODE, CAT1]);
      await q.fails("select public.scan_create_product($1, 'Dos', $2, 10)", [NEW_CODE, CAT1], "23505");
      assert.equal(await count(q, "select count(*) n from public.audit_log where table_name = 'products' and actor_id = $1", [ID.empleado]), 1);
    });
  });

  it("no edita datos generales: ni directo ni por funciones ajenas", async () => {
    await asUser(db, ID.empleado, async (q) => {
      const u = await q("update public.products set name = 'Hack' where id = $1", [P1]);
      assert.equal(u.affectedRows, 0); // RLS: no ve la fila
      await q.fails("insert into public.products (name, category_id) values ('x', $1)", [CAT1], "42501");
      await q.fails("insert into public.product_images (product_id, path) values ($1, 'products/x.webp')", [P1], "42501");
      assert.equal((await q("update public.categories set name = 'Hack'")).affectedRows, 0);
      await q.fails("insert into public.categories (name, slug) values ('N', 'n')", [], "42501");
      assert.equal((await q("delete from public.categories")).affectedRows, 0);
    });
  });

  it("lee categorías pero no gestiona usuarios ni roles", async () => {
    await asUser(db, ID.empleado, async (q) => {
      assert.equal(await count(q, "select count(*) n from public.categories"), 2);
      await q.fails("select public.admin_create_profile($1, 'X', 'empleado')", [ID.sinPerfil], "42501");
      await q.fails("select public.admin_set_role($1, 'gerente')", [ID.empleado], "42501");
      await q.fails("select public.admin_set_active($1, false)", [ID.inactivo], "42501");
      await q.fails("update public.profiles set role = 'ceo' where user_id = $1", [ID.empleado], "42501");
      await q.fails("insert into public.profiles (user_id, display_name, role) values ($1, 'X', 'ceo')", [ID.sinPerfil], "42501");
    });
  });

  it("no administra imágenes ni archiva/despublica ni reasigna categorías", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/y.webp')", [], "42501");
      assert.equal(await count(q, "select count(*) n from storage.objects"), 0);
      assert.equal((await q("update public.products set archived_at = now()")).affectedRows, 0);
      assert.equal((await q("update public.products set publish_enabled = false")).affectedRows, 0);
      await q.fails("select public.reassign_category_products($1, $2)", [CAT1, CAT2], "42501");
    });
  });

  it("ve solo su propio historial", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_set_price($1, 1500)", [V1]);
    });
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_set_price($1, 1600)", [V1]);
      const rows = (await q("select distinct actor_id from public.audit_log")).rows;
      assert.deepEqual(rows.map((r) => r.actor_id), [ID.empleado]);
    });
  });
});

describe("gerente", () => {
  it("gestiona productos, variantes, imágenes y categorías", async () => {
    await asUser(db, ID.gerente, async (q) => {
      assert.equal(await count(q, "select count(*) n from public.products"), 2);
      await q("update public.products set name = 'Balde 12L', publish_enabled = false where id = $1", [P1]);
      await q("insert into public.product_variants (product_id, price) values ($1, 2000)", [P1]);
      await q("insert into public.product_images (product_id, path) values ($1, 'products/x/b.webp')", [P1]);
      await q("insert into public.categories (name, slug) values ('Tapas', 'tapas')");
      await q("update public.categories set name = 'Tapas grandes' where slug = 'tapas'");
      await q("delete from public.categories where slug = 'tapas'");
      assert.equal(await q("select public.reassign_category_products($1, $2) as n", [CAT1, CAT2]).then((r) => Number(r.rows[0].n)), 1);
      const c = (await q("select category_id from public.products where id = $1", [P1])).rows[0].category_id;
      assert.equal(c, CAT2);
    });
  });

  it("archiva y despublica de forma independiente", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q("update public.products set archived_at = now() where id = $1", [P1]);
      const r = (await q("select publish_enabled, archived_at is not null as archived from public.products where id = $1", [P1])).rows[0];
      assert.deepEqual(r, { publish_enabled: true, archived: true });
      await q("update public.products set archived_at = null, publish_enabled = false where id = $1", [P1]);
      const r2 = (await q("select publish_enabled, archived_at is not null as archived from public.products where id = $1", [P1])).rows[0];
      assert.deepEqual(r2, { publish_enabled: false, archived: false });
      assert.equal(await count(q, "select count(*) n from public.products"), 2); // nada se borró
    });
  });

  it("sube, actualiza y elimina fotos solo bajo products/", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q("insert into storage.objects (bucket_id, name) values ('product-images', 'products/p1/nueva.webp')");
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'otra/ruta.webp')", [], "42501");
      assert.equal((await q("update storage.objects set name = 'products/p1/renombrada.webp' where name = 'products/p1/nueva.webp'")).affectedRows, 1);
      assert.equal((await q("delete from storage.objects where name = 'products/p1/renombrada.webp'")).affectedRows, 1);
    });
  });

  it("puede usar el escáner", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q("select public.scan_set_price($1, 3000)", [V1]);
      assert.equal((await q("select public.scan_lookup('7790001000011') as r")).rows[0].r.variants[0].price, 3000);
    });
  });

  it("no administra usuarios, no se hace CEO y no cambia nada de perfiles", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q.fails("select public.admin_set_role($1, 'ceo')", [ID.gerente], "42501");
      await q.fails("select public.admin_set_role($1, 'gerente')", [ID.empleado], "42501");
      await q.fails("select public.admin_create_profile($1, 'X', 'ceo')", [ID.sinPerfil], "42501");
      await q.fails("select public.admin_set_active($1, false)", [ID.empleado], "42501");
      await q.fails("update public.profiles set role = 'ceo' where user_id = $1", [ID.gerente], "42501");
      await q.fails("delete from public.profiles where user_id = $1", [ID.empleado], "42501");
    });
  });

  it("ve la auditoría del catálogo del equipo, no la de perfiles", async () => {
    // Cada transacción se revierte: se siembran filas de auditoría y se lee como gerente.
    await asAdmin(db, async (q) => {
      await q("insert into public.audit_log (actor_id, actor_role, table_name, row_id, operation, source) values ($1, 'empleado', 'products', 'x', 'UPDATE', 'api'), ($1, 'ceo', 'profiles', 'y', 'UPDATE', 'api')", [ID.ceo]);
      await q("set local role authenticated");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ID.gerente })]);
      const tables = (await q("select distinct table_name from public.audit_log order by 1")).rows.map((r) => r.table_name);
      assert.ok(tables.includes("products"));
      assert.ok(!tables.includes("profiles"));
    });
  });
});

describe("CEO", () => {
  it("crea, activa, desactiva y cambia roles de otros", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_create_profile($1, ' Nueva ', 'empleado')", [ID.sinPerfil]);
      const p = (await q("select display_name, role, active, created_by from public.profiles where user_id = $1", [ID.sinPerfil])).rows[0];
      assert.deepEqual(p, { display_name: "Nueva", role: "empleado", active: true, created_by: ID.ceo });
      await q("select public.admin_set_role($1, 'gerente')", [ID.sinPerfil]);
      await q("select public.admin_set_active($1, false)", [ID.sinPerfil]);
      await q("select public.admin_set_active($1, true)", [ID.sinPerfil]);
      await q("select public.admin_set_display_name($1, 'Otra')", [ID.sinPerfil]);
      await q.fails("select public.admin_create_profile('99999999-0000-4000-8000-000000000000', 'X', 'empleado')", [], "P0002");
      await q.fails("select public.admin_set_role('99999999-0000-4000-8000-000000000000', 'empleado')", [], "P0002");
    });
  });

  it("ve todos los perfiles y toda la auditoría", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_set_role($1, 'gerente')", [ID.empleado]);
      assert.equal(await count(q, "select count(*) n from public.profiles"), 5);
      const t = (await q("select distinct table_name from public.audit_log")).rows.map((r) => r.table_name);
      assert.ok(t.includes("profiles"));
    });
  });

  it("no cambia su propio rol ni se desactiva", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q.fails("select public.admin_set_role($1, 'empleado')", [ID.ceo], "42501");
      await q.fails("select public.admin_set_active($1, false)", [ID.ceo], "42501");
    });
  });

  it("un empleado desactivado pierde el acceso en el acto", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_set_active($1, false)", [ID.empleado]);
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ID.empleado })]);
      await q.fails("select public.scan_lookup('7790001000011')", [], "42501");
    });
  });
});

describe("último CEO activo", () => {
  it("no se puede degradar, desactivar ni eliminar al único CEO (ni desde SQL)", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.profiles set role = 'gerente' where user_id = $1", [ID.ceo2]); // quedan: ceo
      await q.fails("update public.profiles set role = 'gerente' where user_id = $1", [ID.ceo], "23514");
      await q.fails("update public.profiles set active = false where user_id = $1", [ID.ceo], "23514");
      await q.fails("delete from public.profiles where user_id = $1", [ID.ceo], "23514");
    });
  });

  it("con dos CEO se puede degradar a uno; al segundo ya no", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_set_role($1, 'gerente')", [ID.ceo2]);
    });
    await asAdmin(db, async (q) => {
      await q("update public.profiles set role = 'gerente' where user_id = $1", [ID.ceo2]);
      await q.fails("update public.profiles set role = 'gerente' where user_id = $1", [ID.ceo], "23514");
    });
  });

  it("un CEO inactivo no cuenta como CEO activo", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.profiles set active = false where user_id = $1", [ID.ceo2]);
      await q.fails("update public.profiles set active = false where user_id = $1", [ID.ceo], "23514");
    });
  });
});

describe("escalada de privilegios", () => {
  it("nadie se asigna un rol superior por ningún camino", async () => {
    for (const uid of [ID.empleado, ID.gerente]) {
      await asUser(db, uid, async (q) => {
        await q.fails("update public.profiles set role = 'ceo' where user_id = $1", [uid], "42501");
        await q.fails("select public.admin_set_role($1, 'ceo')", [uid], "42501");
        await q.fails("select public.admin_create_profile($1, 'Yo', 'ceo')", [uid], "42501");
        await q.fails("insert into public.profiles (user_id, display_name, role) values ($1, 'Yo', 'ceo')", [ID.sinPerfil], "42501");
      });
    }
  });

  it("el trigger bloquea el cambio aunque alguien consiguiera permiso de tabla", async () => {
    await asAdmin(db, async (q) => {
      await q("grant update on public.profiles to authenticated"); // simula una configuración errónea
      await q("create policy tmp_update on public.profiles for update to authenticated using (true) with check (true)");
      await q("set local role authenticated");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ID.gerente })]);
      await q.fails("update public.profiles set role = 'ceo' where user_id = $1", [ID.gerente], "42501");
    });
  });
});

describe("auditoría", () => {
  it("registra insert, update y delete con valores anteriores y nuevos", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q("insert into public.categories (name, slug) values ('Tapas', 'tapas')");
      await q("update public.categories set name = 'Tapas XL' where slug = 'tapas'");
      await q("delete from public.categories where slug = 'tapas'");
      const r = (await q(`select operation, actor_id, actor_role, old_data->>'name' o, new_data->>'name' n, changed_fields
        from public.audit_log where table_name = 'categories' and actor_id = $1 order by id`, [ID.gerente])).rows;
      assert.deepEqual(r, [
        { operation: "INSERT", actor_id: ID.gerente, actor_role: "gerente", o: null, n: "Tapas", changed_fields: null },
        { operation: "UPDATE", actor_id: ID.gerente, actor_role: "gerente", o: "Tapas", n: "Tapas XL", changed_fields: ["name"] },
        { operation: "DELETE", actor_id: ID.gerente, actor_role: "gerente", o: "Tapas XL", n: null, changed_fields: null },
      ]);
    });
  });

  it("no registra actualizaciones sin cambios reales", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q("update public.categories set name = name");
      assert.equal(await count(q, "select count(*) n from public.audit_log where actor_id = $1", [ID.gerente]), 0);
    });
  });

  it("los cambios desde SQL quedan con source = sql y sin actor", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.categories set name = 'Baldes!' where id = $1", [CAT1]);
      const r = (await q("select actor_id, source from public.audit_log where table_name = 'categories' order by id desc limit 1")).rows[0];
      assert.deepEqual(r, { actor_id: null, source: "sql" });
    });
  });

  it("es inmutable para todos, incluido el propietario", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.categories set name = 'Z' where id = $1", [CAT1]);
      await q.fails("update public.audit_log set operation = 'DELETE'", [], "42501");
      await q.fails("delete from public.audit_log", [], "42501");
      await q.fails("truncate public.audit_log", [], "42501");
    });
    for (const uid of [ID.empleado, ID.gerente, ID.ceo]) {
      await asUser(db, uid, async (q) => {
        await q.fails("update public.audit_log set operation = 'DELETE'", [], "42501");
        await q.fails("delete from public.audit_log", [], "42501");
        await q.fails("insert into public.audit_log (table_name, operation, source) values ('x', 'INSERT', 'api')", [], "42501");
      });
    }
  });
});

describe("catálogo público y archivado", () => {
  it("muestra los publicados no archivados y conserva el contrato de columnas", async () => {
    await asAnon(db, async (q) => {
      const r = await q("select * from public.public_catalog");
      assert.deepEqual(r.fields.map((f) => f.name), [
        "id", "name", "brand", "description", "name_sort", "search_text",
        "category_slug", "image_path", "price", "has_price_range",
      ]);
      assert.equal(r.rows.length, 1);
      assert.equal(r.rows[0].name, "Balde 10L");
      assert.equal((await q("select * from public.public_categories")).rows.length, 1);
    });
  });

  it("un producto archivado desaparece del público aunque siga publicado, y vuelve al desarchivar", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.products set archived_at = now() where id = $1", [P1]);
      await q("set local role anon");
      assert.equal(await count(q, "select count(*) n from public.public_catalog"), 0);
      assert.equal(await count(q, "select count(*) n from public.public_categories"), 0);
      await q("reset role");
      assert.equal(await count(q, "select count(*) n from public.products where id = $1", [P1]), 1); // no se borró
      await q("update public.products set archived_at = null where id = $1", [P1]);
      await q("set local role anon");
      assert.equal(await count(q, "select count(*) n from public.public_catalog"), 1);
    });
  });

  it("despublicar y archivar son independientes en la vista pública", async () => {
    await asAdmin(db, async (q) => {
      await q("update public.products set publish_enabled = false where id = $1", [P1]);
      await q("set local role anon");
      assert.equal(await count(q, "select count(*) n from public.public_catalog"), 0);
    });
  });

  it("un producto creado por el escáner no se publica ni con foto y precio", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q("select public.scan_create_product($1, 'Taza', $2, 800)", [NEW_CODE, CAT1]);
    });
    await asAdmin(db, async (q) => {
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ID.empleado })]);
      await q("select public.scan_create_product($1, 'Taza', $2, 800)", [NEW_CODE, CAT1]);
      await q("insert into public.product_images (product_id, path, is_primary) select id, 'products/t/a.webp', true from public.products where barcode = $1", [NEW_CODE]);
      await q("set local role anon");
      assert.equal(await count(q, "select count(*) n from public.public_catalog where name = 'Taza'"), 0);
    });
  });
});
