// SIMULACRO del alcance S2: restaura el respaldo de producción en una base temporal (PGlite) y ejecuta sobre esa copia el script
// de limpieza REAL (sin modificar sus parámetros ni sus ids), primero en simulacro (rollback) y luego aplicado (commit).
// Después prueba la recuperación. No se conecta a Supabase. Ejecutar: cd supabase/tests && node limpieza-simulacro-s2.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { restaurar, huellas, comparar, HUELLA_DATOS, HUELLA_ESTRUCTURA } from "./limpieza-restauracion.mjs";

const R = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");
const LIMPIEZA = readFileSync(R + "limpieza/20261109_limpieza_produccion.PROPUESTA.sql", "utf8");
import { generarSql } from "../limpieza/generar_restauracion.mjs";
import { BACKUP } from "./limpieza-restauracion.mjs";
const RESTAURACION = generarSql(BACKUP);
const out = [];
const ok = (m) => out.push("OK   " + m);
const count = async (db, t) => Number((await db.query(`select count(*)::int as n from ${t}`)).rows[0].n);
const aplicar = (sql) => { assert.ok(sql.trimEnd().endsWith("rollback;")); return sql.trimEnd().replace(/rollback;$/, "commit;"); };

const db = await restaurar();
let h = await huellas(db);
assert.ok(comparar(h.datos, HUELLA_DATOS, "t").every((r) => r.coincide), "la copia restaurada no coincide con producción (datos)");
assert.ok(comparar(h.estructura, HUELLA_ESTRUCTURA, "c").every((r) => r.coincide), "la copia restaurada no coincide con producción (estructura)");
ok("0. La copia restaurada coincide con producción: 11/11 tablas y 13/13 categorías de estructura idénticas");

// 1. Simulacro (rollback): el script real, tal cual
await db.exec(LIMPIEZA);
h = await huellas(db);
assert.ok(comparar(h.datos, HUELLA_DATOS, "t").every((r) => r.coincide));
assert.ok(comparar(h.estructura, HUELLA_ESTRUCTURA, "c").every((r) => r.coincide));
assert.equal(Number((await db.query("select count(*)::int n from pg_namespace where nspname like 'limpieza%'")).rows[0].n), 0);
ok("1. El script real corre completo en simulacro (rollback), pasa las validaciones previas y posteriores y no deja ningún cambio (11/11 huellas de datos y 13/13 de estructura intactas; sin esquema ni tablas de respaldo)");

// 2. Aplicación (commit) sobre la copia
await db.exec(aplicar(LIMPIEZA));
for (const t of ["sales", "sale_items", "stock_movements", "products", "product_variants", "product_images", "promo_banners"]) assert.equal(await count(db, "public." + t), 0, t);
ok("2a. Tras el commit: 0 ventas, 0 detalles, 0 movimientos, 0 productos, 0 variantes y 0 fotos");
h = await huellas(db);
for (const t of ["categories", "payment_methods", "profiles"]) assert.deepEqual(h.datos[t], HUELLA_DATOS[t], t);
ok("2b. Categorías (4), medios de pago (5) y perfil (1): contenido IDÉNTICO al de producción (misma huella)");
assert.deepEqual(h.estructura, HUELLA_ESTRUCTURA);
ok("2c. Estructura sin cambios: 13/13 categorías idénticas (funciones, políticas, triggers, índices, RLS, permisos, Storage)");
const a111 = (await db.query("select count(*)::int n, md5(string_agg(a::text, '|' order by a.id)) h from public.audit_log a where a.id <= 111")).rows[0];
assert.equal(a111.n, 111); assert.equal(a111.h, HUELLA_DATOS.audit_log[1]);
const total = await count(db, "public.audit_log");
assert.ok(total > 111);
const traza = (await db.query("select count(*)::int n from public.audit_log where table_name = 'limpieza_produccion' and via = 'limpieza_produccion_20261109'")).rows[0].n;
assert.equal(traza, 1);
const dels = Object.fromEntries((await db.query("select table_name, count(*)::int n from public.audit_log where id > 111 and operation = 'DELETE' group by 1")).rows.map((r) => [r.table_name, r.n]));
assert.equal(dels.products, 10); assert.equal(dels.product_variants, 10); assert.equal(dels.product_images, 1);
ok(`2d. audit_log: las 111 filas originales IDÉNTICAS (misma huella) y ${total - 111} filas nuevas: 10 bajas de productos, 10 de variantes, 1 de foto y 1 constancia de la limpieza`);
const trg = (await db.query("select tgname, tgenabled from pg_trigger where not tgisinternal and tgname in ('sales_no_change','sale_items_no_change','stock_movements_no_change','sales_no_truncate','sale_items_no_truncate','stock_movements_no_truncate','audit_log_no_change','audit_log_no_truncate')")).rows;
assert.equal(trg.length, 8); assert.ok(trg.every((x) => x.tgenabled === "O"));
ok("2e. Los 8 triggers de protección quedan habilitados");
const rls = (await db.query("select count(*)::int n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity")).rows[0].n;
assert.equal(rls, 11);
ok("2f. RLS activo en las 11 tablas");
assert.equal(Number((await db.query("select count(*)::int n from public.product_variants")).rows[0].n), 0);
ok("2g. Stock consistente: no quedan variantes (0 variantes, 0 movimientos)");
const sec = Object.fromEntries((await db.query("select sequencename, last_value::int v from pg_sequences where schemaname = 'public'")).rows.map((r) => [r.sequencename, r.v]));
assert.equal(sec.sales_number_seq, 5); assert.equal(sec.stock_movements_id_seq, 10);
ok("2h. La numeración NO se reinició (ventas en 5, movimientos en 10): lo siguiente continúa en 6 y 11");
assert.equal(Number((await db.query("select count(*)::int n from pg_namespace where nspname like 'limpieza%'")).rows[0].n), 0);
ok("2h2. La limpieza no dejó esquemas ni tablas permanentes de respaldo en la base");
for (const sql of ["truncate public.sales, public.sale_items, public.stock_movements", "truncate public.audit_log"]) {
  await db.exec("begin"); await assert.rejects(() => db.exec(sql), (e) => e.code === "42501"); await db.exec("rollback");
}
ok("2i. La protección sigue vigente: TRUNCATE sobre ventas, detalles, movimientos y audit_log falla con 42501");

// 3. Recuperación desde el respaldo EXTERNO (el SQL se genera a partir de datos_tablas.json)
await db.exec(RESTAURACION); // simulacro
assert.equal(await count(db, "public.sales"), 0);
await db.exec(aplicar(RESTAURACION));
h = await huellas(db);
for (const t of ["products", "product_variants", "product_images", "sales", "sale_items", "stock_movements", "categories", "payment_methods", "profiles"]) assert.deepEqual(h.datos[t], HUELLA_DATOS[t], "recuperación: " + t);
ok("3. Recuperación: tras restaurar desde el respaldo externo, 9 tablas vuelven con la MISMA huella que producción (ventas, detalles, movimientos, productos, variantes, fotos, categorías, medios de pago y perfil)");

console.log(out.join("\n"));
console.log(`\n${out.length} comprobaciones del simulacro S2 pasaron.`);
