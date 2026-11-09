# El Mundo del Plástico: instrucciones del proyecto

Suma a las reglas de `AImpulse/CLAUDE.md` (tabla de resumen al crear ramas o migraciones, nada a `main` sin visto bueno, nunca `service_role`). No las contradice.

@AGENTS.md

## Antes de empezar, o después de `/clear`

1. Leer `docs/estado.md`: qué está aplicado en Supabase, qué parte del panel es real y qué es demostración, y los pendientes abiertos.
2. Leer `docs/decisiones.md` si la tarea toca diseño, datos, permisos o proceso.
3. El resto de `docs/` se abre solo por tema; el índice está en `docs/README.md`.

`docs/` y `supabase/` **están en Git desde el commit de consolidación de la Etapa 0** (quedan fuera `docs/capturas/`, `Logo/`, `.impeccable/` y `supabase/tests/node_modules`; ver `.gitignore`). La migración o corrección que se agregue debe versionarse junto con su documentación.

## Qué es

Catálogo público de un comercio de Río Turbio, Santa Cruz (plásticos, cocina, limpieza, librería, regalería) y un panel interno en `/panel` con gestión de productos, banners, categorías, stock y punto de venta con escáner. Las consultas y los pedidos de los clientes salen por WhatsApp: el **carrito público es un armador de pedidos, no una venta** (no registra nada, no toca stock, no hay pagos en línea). Hay un circuito fiscal (ARCA) **preparado y sin emisión**, solo para el grupo de desarrollo (`docs/comprobantes.md`).

Next.js 16 (App Router, `cacheComponents`) · React 19 · TypeScript · Tailwind 4 · Supabase.

## Comandos

```bash
npm run dev                                   # http://localhost:3000
npm run lint
npm run build
npm test                                      # scripts/*.test.mjs, sin base de datos
node supabase/dev/mock-public-api.mjs         # datos ficticios locales (puerto 54321) para ver el catálogo sin tocar producción;
                                              # luego: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock npm run dev
cd supabase/tests && npm install && npm test  # base de datos sobre PGlite (en memoria)
```

Antes de dar algo por terminado: `npx tsc --noEmit`, `npm run lint`, `npm test` y `npm run build`. Las pruebas de `supabase/tests` hacen falta si se tocó SQL. Ninguna prueba usa el Supabase real: decirlo siempre que corresponda.

## Next.js 16

Esta versión cambió APIs. Antes de escribir código de rutas, caché o componentes, leer la guía correspondiente en `node_modules/next/dist/docs/`.

## Reglas que no se rompen

- **El público solo lee las vistas** `public_catalog`, `public_categories`, `public_promo_banners`, `public_product_images` y `public_product_variants`, siempre por `src/lib/catalog/repository.ts`. `anon` no toca las tablas base.
- **La regla de publicación vive en la base** (vista `public_catalog`): habilitado, no archivado, foto principal y al menos una variante con precio mayor que 0. La pantalla no la duplica. Si se agrega otro filtro a esa vista hay que repetirlo en cada migración que la redefine.
- **Los permisos viven en la base** (RLS y funciones por rol: `empleado < gerente < ceo`). Ocultar botones en el panel es comodidad, no protección.
- **Migraciones:** archivo nuevo en `supabase/migrations/` con la marca de tiempo siguiente. Nunca editar una ya aplicada. El repositorio no las ejecuta: las aplica el usuario a mano en Supabase.
- **Clave `service_role`:** jamás en el frontend ni en el repositorio. `.env` está versionado a propósito y solo lleva la URL y la clave pública.
- **Historial de ventas, movimientos de stock y auditoría son de solo agregado.** Una anulación sería un registro nuevo, nunca una edición.
- **Cabeceras de seguridad y CSP** en `next.config.ts` (detalle en `docs/despliegue.md`). Al sumar un servicio externo (analítica, mapas, fuentes, widgets) hay que agregar su origen a la directiva que corresponda; si no, el navegador lo bloquea. La cámara del escáner depende de `Permissions-Policy: camera=(self)`: no cerrarla.
- La IP para abrir el servidor local desde el celular va en `.env.local` (`ALLOWED_DEV_ORIGINS`), nunca en el código. La CI está en `.github/workflows/ci.yml`.
- **Circuito fiscal (ARCA):** separado de la venta (la venta nunca lo dispara) y **solo para el grupo de desarrollo** (`developer_access`; el CEO del comercio NO es de desarrollo). Se exige en el servidor (`/api/fiscal/*`) y en la base (`require_developer()` + RLS). `production_enabled` sigue en `false` y el servidor tiene su propia llave; no hay llamadas a ARCA. Credenciales solo como variables de servidor (`FISCAL_*`), nunca en el repositorio ni con `NEXT_PUBLIC_`. Detalle y lista para habilitar producción: `docs/comprobantes.md`.
- **Comprobante interno** (`receipt-view.tsx`): siempre con la leyenda «no es una factura ni un comprobante fiscal»; sin stock ni códigos.
- **Catálogo público:** no se muestra stock, disponibilidad, materiales ni promociones que no existan en los datos; las promociones solo salen de banners vigentes.
- Precios en pesos enteros, sin centavos. Un producto no se vende hasta tener stock cargado.

## Panel

Un único ingreso real: `/panel/login` usa Supabase Auth (correo y contraseña). El rol sale de `public.profiles` (nunca del token ni de `user_metadata`) y define el menú (`src/lib/panel/roles.ts`); la base lo vuelve a exigir con RLS y funciones. No hay modo demostración. Secciones: Inicio (dashboard con período, medios de pago y movimientos), Escáner y ventas (modo venta, comprobante), Stock, Productos (buscador y stock), Categorías, Banners y Usuarios (solo CEO). CRM y Configuración se retiraron porque no tenían tablas ni funciones reales. Usuarios necesita la migración `20261108000001_admin_list_users`; el estado de aplicación está en `docs/estado.md`.

## Marca y diseño

Colores y tokens de modo claro y oscuro en `src/app/globals.css`. Títulos y precios con Nunito, cuerpo y panel con Geist. La guía de identidad está en `Logo/`. El panel conserva siempre los colores claros. Antes de cambiar algo visual, revisar `docs/decisiones.md`: hay decisiones que vienen de un brief del negocio.

## Mantener la documentación

Al terminar un trabajo que cambie el esquema, un permiso, una decisión o el estado de producción, actualizar `docs/estado.md` y, si hubo una decisión, `docs/decisiones.md`. Lo que se confirma en una conversación y no se anota se pierde con el próximo `/clear`.
