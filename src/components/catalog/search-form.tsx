type Props = {
  q?: string;
  category?: string;
};

/**
 * Buscador del catálogo, en la navegación de todas las páginas públicas. Formulario GET: funciona sin JavaScript, deja
 * la búsqueda en la URL y conserva la categoría elegida.
 */
export function SearchForm({ q, category }: Props) {
  return (
    <form
      id="buscar"
      action="/#catalogo"
      method="get"
      role="search"
      className="flex scroll-mt-4 items-center rounded-full bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-on-nav"
    >
      {category && <input type="hidden" name="categoria" value={category} />}
      <label htmlFor="q" className="sr-only">
        Buscar productos
      </label>
      <button
        type="submit"
        aria-label="Buscar"
        className="grid size-11 shrink-0 place-items-center rounded-full text-brand-ink hover:bg-brand-sand active:bg-brand-line focus-visible:outline-offset-[-3px] motion-safe:transition-colors"
      >
        <svg viewBox="0 0 24 24" className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </button>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Buscar productos…"
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 min-w-0 flex-1 rounded-r-full bg-transparent pr-4 text-base text-brand-ink outline-none placeholder:text-brand-muted lg:text-sm"
      />
    </form>
  );
}
