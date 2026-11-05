# El Mundo del Plástico

Catálogo público y panel interno de un comercio de Río Turbio, Santa Cruz. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase.

- **Catálogo público** (`/`): categorías, buscador, ficha de producto y consulta por WhatsApp. Lee solo vistas públicas de Supabase. Sin carrito ni pagos en línea.
- **Panel interno** (`/panel`): productos, categorías, banners, stock y punto de venta con escáner, con roles `empleado`, `gerente` y `ceo`. Usuarios, CRM y Configuración siguen en demostración.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
npm test         # pruebas de scripts/*.test.mjs, sin base de datos
```

Las pruebas de la base de datos están en `supabase/tests` (PGlite, en memoria): `cd supabase/tests && npm install && npm test`.

## Configuración

Copiar `.env.local.example` como `.env.local` y completar:

| Variable | Qué es |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **pública** (anon / publishable). Nunca la `service_role` |
| `NEXT_PUBLIC_SITE_URL` | Dirección pública del sitio, para el enlace canónico y la vista previa al compartir. Sin ella no se publica `localhost` |

Sin las variables de Supabase el catálogo queda vacío. Los datos de contacto (WhatsApp, teléfono, Instagram, Facebook) se completan en `src/config/contact.ts`; un canal sin dato no se muestra.

## Estructura

- `src/app/(site)/` — catálogo público: portada, ficha `producto/[slug]` y ventana flotante de producto (`@modal`).
- `src/app/panel/` — panel interno: `login` y las secciones bajo `(shell)/`.
- `src/components/catalog/`, `product/`, `contact/` — piezas del sitio público.
- `src/components/panel/` — panel: secciones, punto de venta (`pos/`), escáner y componentes comunes.
- `src/lib/catalog/` — `repository.ts` es el único acceso a datos del público, con caché.
- `src/lib/products/`, `categories/`, `banners/`, `pos/`, `barcode/` — lógica del panel y de las reglas de negocio.
- `src/lib/supabase/` — clientes de Supabase (público y del navegador).
- `src/lib/panel-demo/` — datos de demostración del panel.
- `src/config/` — contacto y textos del catálogo.
- `scripts/*.test.mjs` — pruebas versionadas.
- `public/brand/` — logo y logos de pago.

## Documentación

`CLAUDE.md` guarda las instrucciones para trabajar con Claude Code. La documentación está en `docs/`; empezar por `docs/README.md`, `docs/estado.md` (qué está aplicado, qué falta) y `docs/decisiones.md`.

**`docs/`, `supabase/` (migraciones, pruebas de base), `Logo/` y `.impeccable/` no están en Git** por decisión anterior (ver `.gitignore`). Un clon de este repositorio no los trae.

## Reglas importantes

- Un producto se publica solo si está habilitado, no archivado, con foto principal y al menos una variante con precio mayor que 0. La regla vive en la base (vista `public_catalog`), no en la pantalla.
- Los permisos se aplican en la base (RLS y funciones por rol). Ocultar botones en el panel no es protección.
- Los cambios en productos o precios tardan hasta 2 minutos en verse en el catálogo por la caché.
- Las migraciones se aplican a mano en Supabase; el repositorio no las ejecuta.
- Nunca poner la clave `service_role` en el frontend ni en el repositorio. `.env` está versionado a propósito y solo lleva la URL y la clave pública.
