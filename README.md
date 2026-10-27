# El Mundo del Plástico — Catálogo (Fase 1)

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4. Supabase todavía no está conectado.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Estructura

- `src/app/` — `layout.tsx`, `page.tsx` (catálogo), `error.tsx`, `globals.css` (colores de la marca).
- `src/components/catalog/` — `product-card`, `product-grid`, `category-nav`, `search-form`, `pagination`, `catalog-view`, `catalog-skeleton`.
- `src/lib/catalog/` — `repository.ts` (único acceso a datos), `publication-rules.ts` (regla de publicación), `sample-data.ts` (**datos de ejemplo**), `url.ts`.
- `src/types/product.ts` — modelo **provisional** de producto.

## Notas

- Búsqueda, categoría y página viven en la URL (`?q=&categoria=&pagina=`) y se resuelven en el servidor.
- La regla de publicación (precio válido + foto válida + habilitado) se aplica en `repository.ts`, no en la UI.
- Todos los productos, categorías y precios actuales son de ejemplo.
