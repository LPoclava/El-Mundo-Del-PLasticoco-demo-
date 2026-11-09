// Genera el SQL de RECUPERACIÓN a partir del respaldo externo (datos_tablas.json). No se conecta a ninguna base.
// Uso: node supabase/limpieza/generar_restauracion.mjs [carpeta_del_respaldo] [archivo_de_salida]
// El SQL generado deja de nuevo en public los productos, variantes, fotos, ventas, detalles y movimientos respaldados.
// Termina en ROLLBACK (simulacro); para aplicar de verdad hay que cambiarlo por COMMIT y hace falta aprobación explícita.
// Contiene los datos de prueba respaldados: guardarlo FUERA del repositorio (por defecto se escribe en la carpeta del respaldo).
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CARPETA_RESPALDO_POR_DEFECTO = process.env.RESPALDO_LIMPIEZA ?? join(homedir(), "Respaldos-AImpulse", "limpieza_2026-11-09");

const COLUMNAS = {
  products: "id, name, category_id, description, brand, sku, barcode, publish_enabled, created_at, updated_at, archived_at, created_by",
  product_variants: "id, product_id, size, color, price, position, stock",
  product_images: "id, product_id, path, is_primary, position",
  sales: "id, number, created_at, user_id, user_name, payment_method, total, status, idempotency_key",
  sale_items: "id, sale_id, variant_id, product_id, barcode, product_name, variant_label, unit_price, quantity",
  stock_movements: "id, created_at, variant_id, delta, stock_after, reason, sale_id, user_id, note",
};
const IDENTIDAD = new Set(["sales", "stock_movements"]);

export function generarSql(dir = CARPETA_RESPALDO_POR_DEFECTO) {
  const datos = JSON.parse(readFileSync(join(dir, "datos_tablas.json"), "utf8"));
  const bloque = (tabla) => {
    const filas = datos[tabla];
    const json = JSON.stringify(filas);
    if (json.includes("$json$")) throw new Error("el JSON contiene el delimitador");
    const ov = IDENTIDAD.has(tabla) ? " overriding system value" : "";
    return `insert into public.${tabla} (${COLUMNAS[tabla]})${ov}\n  select ${COLUMNAS[tabla]} from jsonb_populate_recordset(null::public.${tabla}, $json$${json}$json$::jsonb);`;
  };
  const n = (t) => datos[t].length;
  return `-- RECUPERACIÓN DESDE EL RESPALDO EXTERNO (generada por supabase/limpieza/generar_restauracion.mjs). NO EJECUTAR SIN APROBACIÓN.
-- Devuelve a public: ${n("products")} productos, ${n("product_variants")} variantes, ${n("product_images")} fotos, ${n("sales")} ventas, ${n("sale_items")} detalles y ${n("stock_movements")} movimientos.
-- No toca RLS, políticas ni los triggers de «solo agregado» (INSERT está permitido). Deshabilita UN trigger de registro,
-- product_variants_stock_log, durante la carga (si no, duplicaría los movimientos); se rehabilita al final y, si algo falla,
-- la transacción lo deshace sola. Termina en ROLLBACK (simulacro): para aplicar, cambiar la última línea por «commit;».
begin;
set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.sales) or exists (select 1 from public.sale_items) or exists (select 1 from public.stock_movements) then
    raise exception 'Guarda: las tablas de ventas ya tienen filas; no se restaura encima';
  end if;
  if exists (select 1 from public.products) or exists (select 1 from public.product_variants) then
    raise exception 'Guarda: ya hay productos o variantes; no se restaura encima';
  end if;
end $$;

alter table public.product_variants disable trigger product_variants_stock_log;

${bloque("products")}
${bloque("product_variants")}
${bloque("product_images")}
${bloque("sales")}
${bloque("sale_items")}
${bloque("stock_movements")}

alter table public.product_variants enable trigger product_variants_stock_log;

do $$
declare v_mal int;
begin
  if (select count(*) from public.products) <> ${n("products")} or (select count(*) from public.product_variants) <> ${n("product_variants")}
     or (select count(*) from public.product_images) <> ${n("product_images")} or (select count(*) from public.sales) <> ${n("sales")}
     or (select count(*) from public.sale_items) <> ${n("sale_items")} or (select count(*) from public.stock_movements) <> ${n("stock_movements")} then
    raise exception 'Post: las cantidades restauradas no coinciden con el respaldo';
  end if;
  select count(*) into v_mal from public.product_variants v
   where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0);
  if v_mal > 0 then raise exception 'Post: % variante(s) con stock distinto de la suma de movimientos', v_mal; end if;
  if (select count(*) from pg_trigger t where not t.tgisinternal and t.tgenabled = 'O' and t.tgname = 'product_variants_stock_log') <> 1 then
    raise exception 'Post: el trigger product_variants_stock_log no quedó habilitado';
  end if;
  raise notice 'Restauración: validaciones OK';
end $$;

rollback;
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const dir = process.argv[2] ?? CARPETA_RESPALDO_POR_DEFECTO;
  const salida = process.argv[3] ?? join(dir, "restaurar_en_produccion.PROPUESTA.sql");
  writeFileSync(salida, generarSql(dir));
  console.log("Generado:", salida);
}
