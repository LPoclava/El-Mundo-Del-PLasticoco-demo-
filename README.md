# El Mundo del Plástico — Catálogo público

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (solo lectura pública).

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Configuración

Copiar `.env.local.example` como `.env.local` y completar:

| Variable | Qué es |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **pública** (anon / publishable). Nunca la `service_role` |
| `NEXT_PUBLIC_SITE_URL` | Dirección pública del sitio, para la vista previa al compartir el enlace |

Sin las variables de Supabase el catálogo queda vacío. Con ellas lee las vistas públicas `public_catalog` y `public_categories`.

Los datos de contacto (WhatsApp, teléfono, Instagram, Facebook) se completan en `src/config/contact.ts`. Un canal sin dato no se muestra al público.

## Estructura

- `src/app/` — `layout.tsx`, `page.tsx` (catálogo y contacto), `error.tsx`, `globals.css` (colores de la marca).
- `src/components/catalog/` — buscador, categorías, tarjetas, cuadrícula, paginación y estados.
- `src/components/contact/` — sección de contacto e íconos.
- `src/lib/catalog/` — `repository.ts` (único acceso a datos, con caché de 1 a 2 minutos), `query.ts`, `url.ts`.
- `src/lib/supabase/public.ts` — cliente de solo lectura pública.
- `supabase/migrations/` — esquema de la base. `supabase/rollback/` — reversión (no es una migración).
- `docs/modelo-de-datos.md` — modelo de datos, seguridad, decisiones y pendientes.
- `docs/promociones-y-banners.md` — categorías principales, carrusel «Promociones y combos» y panel de banners.

## Reglas importantes

- Un producto se publica solo si está habilitado, tiene foto principal y al menos una variante con precio mayor que 0. La regla vive en la base (vista `public_catalog`), no en la pantalla.
- Los cambios en productos o precios tardan hasta 2 minutos en verse en el catálogo por la caché.
- Las migraciones se aplican a mano en Supabase; el repositorio no las ejecuta.
- Nunca poner la clave `service_role` en el frontend ni en el repositorio.
