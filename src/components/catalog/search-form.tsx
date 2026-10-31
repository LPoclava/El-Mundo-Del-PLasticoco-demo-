type Props = {
  q?: string;
  category?: string;
};

/**
 * Buscador del catálogo (va en el encabezado de todas las páginas públicas). Formulario GET: funciona sin
 * JavaScript, deja la búsqueda en la URL y conserva la categoría elegida.
 */
export function SearchForm({ q, category }: Props) {
  return (
    <form
      id="buscar"
      action="/#catalogo"
      method="get"
      role="search"
      className="flex scroll-mt-4 items-center rounded-lg border border-brand-line bg-brand-cream focus-within:border-brand-ink focus-within:bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-ink"
    >
      {category && <input type="hidden" name="categoria" value={category} />}
      <label htmlFor="q" className="sr-only">
        Buscar productos
      </label>
      <span className="grid w-10 shrink-0 place-items-center text-brand-muted" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </span>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar un producto"
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 min-w-0 flex-1 bg-transparent pr-2 text-base outline-none placeholder:text-brand-muted sm:text-sm"
      />
      <button
        type="submit"
        className="m-1 h-9 shrink-0 rounded-md bg-brand-ink px-3 text-sm font-medium text-white hover:bg-brand-ink/85 motion-safe:transition-colors motion-safe:active:scale-95"
      >
        Buscar
      </button>
    </form>
  );
}
