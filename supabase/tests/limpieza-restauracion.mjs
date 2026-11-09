// Restaura el RESPALDO de producción (JSON) en una base TEMPORAL en memoria (PGlite) y compara las huellas con las de producción.
// No se conecta a Supabase. La estructura sale de las 19 migraciones + el cierre; los datos, del respaldo.
// Ejecutar: cd supabase/tests && node limpieza-restauracion.mjs [carpeta_del_respaldo]
// Exporta la base restaurada para que otros scripts (simulacro S2) la reutilicen: importar { restaurar }.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const R = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");
const H = await import(pathToFileURL(R + "tests/helpers.mjs").href);
const { newDb, applyMigrations } = H;
export const BACKUP = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : (process.env.RESPALDO_LIMPIEZA ?? join(homedir(), "Respaldos-AImpulse", "limpieza_2026-11-09"));
const CEO_ID = "ba7060ae-edae-4bdd-bc89-86ede2593712";

// Huellas de PRODUCCIÓN tomadas con el conector el 9 de noviembre de 2026 (antes de generar el respaldo).
export const HUELLA_DATOS = {
  audit_log: [111, "3291702a659d614495aae7486574857d"], categories: [4, "68c1f342ab33a6de125436dc80adfc71"],
  payment_methods: [5, "9f8c76ac0d495fb512744531bea06bb4"], product_images: [1, "6958a705ce8264c5594c1f64b5d68cc9"],
  product_variants: [10, "305243e9bce6df1eb6abb8fe2e9c04e3"], products: [10, "d10879229d5a1ab8a6df4a7327950d43"],
  profiles: [1, "6cdb87bf9bf90ecd945c96ebb0915829"], promo_banners: [0, "d41d8cd98f00b204e9800998ecf8427e"],
  sale_items: [5, "dccddeb1553bb5157b07a93145e3021e"], sales: [5, "de325ab39ef4903d6726f0743f35fdab"],
  stock_movements: [10, "1bf8f8d38e358c35bb8d99bd3041f00f"],
};
export const HUELLA_ESTRUCTURA = {
  columnas: [142, "432c5af84c3ba989cec638577750ca7c"], enums: [1, "8f2ecfee346b6e0bca998646f91c9120"],
  funciones: [36, "c5cf0ea37d51f6888848a3431f821a2d"], indices: [36, "41bed7c002791004b4a01789a55c986c"],
  permisos_funcion: [72, "9a34f79e9c6b33f09b2ef19ffc5c222a"], permisos_tabla: [39, "c1a245173914433a481166e7b56b7d22"],
  politicas: [21, "284ad17e4e5badcae4e374bc071a5ac1"], restricciones: [69, "a6b077674351d7784572e35dee448d08"],
  rls_por_tabla: [11, "d694926c19d159cbe5d03417bb21e0c2"], storage_buckets: [1, "463ac8d41d32ba1dda04f4c4a8c09121"],
  storage_politicas: [8, "818702f391806e5a5eb3df6b922d7854"], triggers: [22, "171b0f9caec4acd19a1a48274fbd079d"],
  vistas: [5, "702635b85a23b0a42dd73a99aaf1f325"],
};

const SQL_HUELLA_DATOS = readFileSync(R + "limpieza/huella_tablas.sql", "utf8");
const SQL_HUELLA_ESTRUCTURA = readFileSync(R + "limpieza/huella_estructura.sql", "utf8");

export async function restaurar(dir = BACKUP) {
  const db = await newDb();
  // 1. Estructura: migraciones en el mismo orden que en producción y el cierre aplicado.
  await applyMigrations(db, (f) => f < "20261029");
  await db.query("insert into auth.users (id, email) values ($1, $2)", [CEO_ID, "restaurado@respaldo.invalid"]);
  await db.query("insert into public.staff (user_id) values ($1)", [CEO_ID]);
  await applyMigrations(db, (f) => f >= "20261029" && f < "20261031000001");
  await applyMigrations(db, (f) => f >= "20261031000001");
  await db.exec(readFileSync(R + "pending/20261029000099_close_drop_staff.sql", "utf8"));

  // 2. Vaciar lo que sembraron las migraciones y cargar el respaldo. SOLO en esta base temporal: se deshabilitan los
  //    triggers de la sesión (session_replication_role = replica) para insertar tal cual, sin auditar ni reescribir fechas.
  await db.exec("set session_replication_role = replica");
  await db.exec("truncate public.audit_log, public.sale_items, public.stock_movements, public.sales, public.product_images, public.product_variants, public.products, public.promo_banners, public.payment_methods, public.profiles, public.categories cascade");
  const datos = JSON.parse(readFileSync(join(dir, "datos_tablas.json"), "utf8"));
  const audit = readdirSync(dir).filter((f) => /^audit_log_\d+_\d+\.json$/.test(f)).sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const identidad = new Set(["audit_log", "sales", "stock_movements"]);
  const cargar = async (tabla, filas) => {
    if (filas.length === 0) return;
    const cols = Object.keys(filas[0]);
    // todas las filas deben tener las mismas claves
    for (const f of filas) if (Object.keys(f).join() !== cols.join()) throw new Error(`${tabla}: filas con claves distintas`);
    const lista = cols.map((c) => `"${c}"`).join(", ");
    const ov = identidad.has(tabla) ? " overriding system value" : "";
    await db.query(`insert into public.${tabla} (${lista})${ov} select ${lista} from jsonb_populate_recordset(null::public.${tabla}, $1::jsonb)`, [JSON.stringify(filas)]);
  };
  for (const t of ["categories", "payment_methods", "profiles", "products", "product_variants", "product_images", "promo_banners", "sales", "sale_items", "stock_movements"]) {
    await cargar(t, datos[t]);
  }
  await cargar("audit_log", audit);
  await db.exec("reset session_replication_role");
  await db.exec("select setval(pg_get_serial_sequence('public.audit_log','id'), (select max(id) from public.audit_log))");
  await db.exec("select setval(pg_get_serial_sequence('public.sales','number'), (select max(number) from public.sales))");
  await db.exec("select setval(pg_get_serial_sequence('public.stock_movements','id'), (select max(id) from public.stock_movements))");
  return db;
}

export async function huellas(db) {
  const d = Object.fromEntries((await db.query(SQL_HUELLA_DATOS)).rows.map((r) => [r.tabla, [Number(r.filas), r.huella]]));
  const e = Object.fromEntries((await db.query(SQL_HUELLA_ESTRUCTURA)).rows.map((r) => [r.categoria, [Number(r.elementos), r.huella]]));
  return { datos: d, estructura: e };
}

export function comparar(actual, esperado, etiqueta) {
  const out = [];
  for (const k of Object.keys(esperado)) {
    const a = actual[k], e = esperado[k];
    const ok = a && a[0] === e[0] && a[1] === e[1];
    out.push({ [etiqueta]: k, esperado: `${e[0]} · ${e[1]}`, restaurado: a ? `${a[0]} · ${a[1]}` : "(falta)", coincide: ok });
  }
  return out;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const db = await restaurar();
  const h = await huellas(db);
  const datos = comparar(h.datos, HUELLA_DATOS, "tabla");
  const estr = comparar(h.estructura, HUELLA_ESTRUCTURA, "categoria");
  console.log("=== DATOS (huella de cada tabla: producción contra restaurado) ===");
  for (const r of datos) console.log(`${r.coincide ? "IGUAL    " : "DIFERENTE"} ${String(r.tabla).padEnd(18)} prod: ${r.esperado} | rest: ${r.restaurado}`);
  console.log("=== ESTRUCTURA ===");
  for (const r of estr) console.log(`${r.coincide ? "IGUAL    " : "DIFERENTE"} ${String(r.categoria).padEnd(18)} prod: ${r.esperado} | rest: ${r.restaurado}`);
  const okD = datos.every((r) => r.coincide), okE = estr.every((r) => r.coincide);
  console.log(`\nDatos: ${datos.filter((r) => r.coincide).length}/${datos.length} tablas idénticas. Estructura: ${estr.filter((r) => r.coincide).length}/${estr.length} categorías idénticas.`);
  process.exitCode = okD && okE ? 0 : 1;
}
