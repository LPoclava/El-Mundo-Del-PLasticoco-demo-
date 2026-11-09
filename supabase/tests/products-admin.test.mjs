// Pruebas de la gestión de productos del panel contra PostgreSQL real (PGlite) con las migraciones
// del repositorio. Reproducen la secuencia exacta de escrituras de src/lib/products/admin.ts
// (saveProduct) con la sesión de cada rol. NO prueban PostgREST ni Supabase Storage reales.
// Ejecutar: cd supabase/tests && npm install && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, CAT1,
  newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asUser, asAdmin,
} from "./helpers.mjs";

let db;
const uuid = () => crypto.randomUUID();
const count = async (q, sql, params) => Number((await q(sql, params)).rows[0].n);

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

/** Paso 1 de saveProduct: alta SIEMPRE sin publicar. */
async function createDraft(q, over = {}) {
  const p = { name: "Maceta de prueba", category_id: CAT1, ...over };
  const cols = Object.keys(p);
  const r = await q(
    `insert into public.products (${cols.join(",")}, publish_enabled) values (${cols.map((_, i) => `$${i + 1}`).join(",")}, false) returning id`,
    cols.map((c) => p[c]),
  );
  return r.rows[0].id;
}
const addImage = async (q, productId, n = 0) =>
  (await q("insert into public.product_images (product_id, path, is_primary, position) values ($1, $2, false, $3) returning id, path",
    [productId, `products/${productId}/${uuid()}.webp`, n])).rows[0];
const addVariant = async (q, productId, price, position = 0) =>
  (await q("insert into public.product_variants (product_id, size, price, position) values ($1, $2, $3, $4) returning id", [productId, `T${position}`, price, position])).rows[0].id;
const visible = async (q, id) => Number((await q("select count(*) n from public.public_catalog where id = $1", [id])).rows[0].n) === 1;
const primaryOf = async (q, id) => (await q("select path from public.product_images where product_id = $1 and is_primary", [id])).rows[0]?.path;

describe("alta y publicación como gerente (secuencia de saveProduct)", () => {
  it("crea sin publicar, agrega foto y precio, elige principal y publica: aparece en el catálogo con esa foto", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q);
      assert.equal(await visible(q, id), false, "recién creado no se ve");
      const a = await addImage(q, id, 0);
      const b = await addImage(q, id, 1);
      await addVariant(q, id, 2500);
      assert.equal(await visible(q, id), false, "sin foto principal ni publicar, sigue oculto");
      // Principal en dos pasos: ninguna actual, se marca la elegida (la segunda).
      await q("update public.product_images set is_primary = true where id = $1", [b.id]);
      await q("update public.products set publish_enabled = true where id = $1", [id]);
      assert.equal(await visible(q, id), true);
      assert.equal(await primaryOf(q, id), b.path, "la foto pública es la elegida en el panel");
      const row = (await q("select image_path, price from public.public_catalog where id = $1", [id])).rows[0];
      assert.equal(row.image_path, b.path);
      assert.equal(String(row.price), "2500");
      assert.notEqual(row.image_path, a.path);
    });
  });

  it("cambiar la principal exige dos pasos: marcar otra mientras existe una falla por el índice único", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Dos fotos" });
      const a = await addImage(q, id, 0);
      const b = await addImage(q, id, 1);
      await q("update public.product_images set is_primary = true where id = $1", [a.id]);
      await q.fails("update public.product_images set is_primary = true where id = $1", [b.id], "23505");
      // Orden correcto: soltar la actual y marcar la nueva.
      await q("update public.product_images set is_primary = false where id = $1", [a.id]);
      await q("update public.product_images set is_primary = true where id = $1", [b.id]);
      assert.equal(await primaryOf(q, id), b.path);
      assert.equal(await count(q, "select count(*) n from public.product_images where product_id = $1 and is_primary", [id]), 1);
    });
  });

  it("si falla marcar la nueva, la compensación devuelve la anterior y el producto sigue visible tras restaurar", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Compensación" });
      const a = await addImage(q, id, 0);
      await addVariant(q, id, 900);
      await q("update public.product_images set is_primary = true where id = $1", [a.id]);
      await q("update public.products set publish_enabled = true where id = $1", [id]);
      assert.equal(await visible(q, id), true);
      await q("update public.product_images set is_primary = false where id = $1", [a.id]);
      assert.equal(await visible(q, id), false, "sin principal el producto publicado queda oculto, nunca roto");
      // El segundo paso falla (id inexistente no cambia filas); se restaura la anterior.
      const r = await q("update public.product_images set is_primary = true where id = $1", [uuid()]);
      assert.equal(r.affectedRows, 0);
      await q("update public.product_images set is_primary = true where id = $1", [a.id]);
      assert.equal(await visible(q, id), true);
    });
  });

  it("máximo 5 fotos por producto", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Cinco fotos" });
      for (let i = 0; i < 5; i++) await addImage(q, id, i);
      const e = await q.fails("insert into public.product_images (product_id, path, is_primary, position) values ($1, $2, false, 5)", [id, `products/${id}/x.webp`]);
      assert.match(e.message, /máximo 5 fotos/i, "el panel traduce este mensaje");
    });
  });

  it("quitar una foto no afecta a las demás ni a la principal", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Quitar foto" });
      const a = await addImage(q, id, 0);
      const b = await addImage(q, id, 1);
      await q("update public.product_images set is_primary = true where id = $1", [a.id]);
      await q("delete from public.product_images where id = $1", [b.id]);
      assert.equal(await count(q, "select count(*) n from public.product_images where product_id = $1", [id]), 1);
      assert.equal(await primaryOf(q, id), a.path);
    });
  });

  it("cambiar el precio no altera nada más y el catálogo muestra el nuevo", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Precio" });
      const img = await addImage(q, id, 0);
      const v = await addVariant(q, id, 1000);
      await q("update public.product_images set is_primary = true where id = $1", [img.id]);
      await q("update public.products set publish_enabled = true where id = $1", [id]);
      await q("update public.product_variants set price = 1450 where id = $1", [v]);
      assert.equal(String((await q("select price from public.public_catalog where id = $1", [id])).rows[0].price), "1450");
    });
  });
});

describe("regla de publicación en public_catalog", () => {
  const publishable = async (q, name) => {
    const id = await createDraft(q, { name });
    const img = await addImage(q, id, 0);
    const v = await addVariant(q, id, 700);
    await q("update public.product_images set is_primary = true where id = $1", [img.id]);
    await q("update public.products set publish_enabled = true where id = $1", [id]);
    return { id, img, v };
  };

  it("oculta si falta la foto principal, el precio, la habilitación o si está archivado", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const ok = await publishable(q, "Todo bien");
      assert.equal(await visible(q, ok.id), true);

      const sinFoto = await publishable(q, "Sin foto");
      await q("update public.product_images set is_primary = false where id = $1", [sinFoto.img.id]);
      assert.equal(await visible(q, sinFoto.id), false);

      const sinPrecio = await publishable(q, "Sin precio");
      await q("update public.product_variants set price = null where id = $1", [sinPrecio.v]);
      assert.equal(await visible(q, sinPrecio.id), false);

      const deshab = await publishable(q, "Deshabilitado");
      await q("update public.products set publish_enabled = false where id = $1", [deshab.id]);
      assert.equal(await visible(q, deshab.id), false);

      const arch = await publishable(q, "Archivado");
      await q("update public.products set archived_at = now() where id = $1", [arch.id]);
      assert.equal(await visible(q, arch.id), false);
      await q("update public.products set archived_at = null where id = $1", [arch.id]);
      assert.equal(await visible(q, arch.id), true, "desarchivar lo devuelve al catálogo");
    });
  });

  it("la base rechaza precios 0, negativos o enormes", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Precios" });
      for (const bad of [0, -5, 1_000_000_000]) {
        await q.fails("insert into public.product_variants (product_id, price) values ($1, $2)", [id, bad], "23514");
      }
    });
  });

  it("el público ve la foto principal elegida, y su categoría y buscador siguen disponibles", async () => {
    // Una sola transacción: se crea como gerente y se lee como anon (cada helper revierte al terminar).
    await asAdmin(db, async (q) => {
      const id = await createDraft(q, { name: "Buscable ñandú" });
      const img = await addImage(q, id, 0);
      await addVariant(q, id, 700);
      await q("update public.product_images set is_primary = true where id = $1", [img.id]);
      await q("update public.products set publish_enabled = true where id = $1", [id]);
      await q("set local role anon");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
      const r = (await q("select image_path, category_slug from public.public_catalog where search_text like '%nandu%'")).rows;
      assert.equal(r.length, 1, "la búsqueda sin tildes lo encuentra");
      assert.equal(r[0].image_path, img.path);
      assert.equal(Number((await q("select count(*) n from public.public_categories where slug = $1", [r[0].category_slug])).rows[0].n), 1);
    });
  });
});

describe("duplicados: los mensajes del panel dependen de estos nombres de restricción", () => {
  it("código de barras y SKU repetidos fallan con 23505 y nombran la columna", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await createDraft(q, { name: "Con código", barcode: "7791234567890", sku: "SKU-1" });
      const dupBarcode = await q.fails("insert into public.products (name, category_id, barcode) values ('Otro', $1, '7791234567890')", [CAT1], "23505");
      assert.match(dupBarcode.message, /barcode/i);
      const dupSku = await q.fails("insert into public.products (name, category_id, sku) values ('Otro', $1, 'SKU-1')", [CAT1], "23505");
      assert.match(dupSku.message, /sku/i);
      await q.fails("insert into public.products (name, category_id, barcode) values ('Mal', $1, '123')", [CAT1], "23514");
    });
  });

  it("repetir el alta con el mismo código (reintento) no duplica el producto", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await createDraft(q, { name: "Reintento", barcode: "7790000111222" });
      await q.fails("insert into public.products (name, category_id, barcode) values ('Reintento', $1, '7790000111222')", [CAT1], "23505");
      assert.equal(await count(q, "select count(*) n from public.products where barcode = '7790000111222'"), 1);
    });
  });
});

describe("permisos", () => {
  it("el empleado no escribe productos, variantes ni fotos por la API directa", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into public.products (name, category_id) values ('x', $1)", [CAT1], "42501");
      await q.fails("insert into public.product_variants (product_id, price) values ($1, 10)", [uuid()], "42501");
      await q.fails("insert into public.product_images (product_id, path) values ($1, 'products/x/a.webp')", [uuid()], "42501");
      const r = await q("update public.products set name = 'hackeado'");
      assert.equal(r.affectedRows, 0, "RLS no deja ver ni cambiar filas");
      assert.equal(await count(q, "select count(*) n from public.products"), 0, "el empleado no lee la tabla directamente");
    });
  });

  it("anon, sin perfil e inactivo tampoco escriben", async () => {
    await asAnon(db, async (q) => {
      await q.fails("insert into public.products (name, category_id) values ('x', $1)", [CAT1], "42501");
    });
    for (const uid of [ID.sinPerfil, ID.inactivo]) {
      await asUser(db, uid, async (q) => {
        await q.fails("insert into public.products (name, category_id) values ('x', $1)", [CAT1], "42501");
      });
    }
  });

  it("el empleado no puede archivar ni publicar", async () => {
    await asAdmin(db, async (q) => {
      const id = await createDraft(q, { name: "Para archivar" });
      await q("set local role authenticated");
      await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.empleado })]);
      const a = await q("update public.products set archived_at = now() where id = $1", [id]);
      const b = await q("update public.products set publish_enabled = true where id = $1", [id]);
      assert.equal(a.affectedRows + b.affectedRows, 0);
      await q("reset role");
      const row = (await q("select archived_at, publish_enabled from public.products where id = $1", [id])).rows[0];
      assert.equal(row.archived_at, null);
      assert.equal(row.publish_enabled, false);
    });
  });

  it("gerente y CEO sí administran; la auditoría registra el cambio con el actor", async () => {
    await asUser(db, ID.ceo2, async (q) => {
      const id = await createDraft(q, { name: "Del CEO" });
      const a = await q("select actor_role, operation from public.audit_log where table_name = 'products' and row_id = $1", [id]);
      assert.deepEqual(a.rows, [{ actor_role: "ceo", operation: "INSERT" }]);
    });
    await asUser(db, ID.gerente, async (q) => {
      const id = await createDraft(q, { name: "Del gerente" });
      const img = await addImage(q, id);
      const r = await q("select actor_role from public.audit_log where table_name = 'product_images' and row_id = $1", [img.id]);
      assert.equal(r.rows[0].actor_role, "gerente");
    });
  });
});

describe("Storage de fotos de producto", () => {
  const put = (q, name) => q("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [name]);

  it("gerente sube y borra bajo products/{id}/; empleado y anon no", async () => {
    const path = `products/${uuid()}/${uuid()}.webp`;
    await asUser(db, ID.gerente, async (q) => {
      await put(q, path);
      await q("delete from storage.objects where name = $1", [path]);
    });
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [path], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', $1)", [path], "42501");
    });
  });

  it("el gerente no escribe fuera de las carpetas permitidas del bucket", async () => {
    await asUser(db, ID.gerente, async (q) => {
      await q.fails("insert into storage.objects (bucket_id, name) values ('product-images', 'privado/a.webp')", [], "42501");
    });
  });
});

describe("borrado de archivos: solo los que ya nadie usa", () => {
  it("una ruta compartida por otra fila se detecta antes de borrarla del Storage", async () => {
    await asUser(db, ID.gerente, async (q) => {
      const a = await createDraft(q, { name: "A" });
      const shared = `products/${a}/compartida.webp`;
      await q("insert into public.product_images (product_id, path) values ($1, $2)", [a, shared]);
      const inUse = await q("select path from public.product_images where path = any($1::text[])", [[shared]]);
      assert.deepEqual(inUse.rows.map((r) => r.path), [shared]);
    });
  });
});
