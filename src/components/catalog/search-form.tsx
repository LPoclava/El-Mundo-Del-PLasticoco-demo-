type Props = {
  q?: string;
  category?: string;
};

/**
 * Buscador del catálogo (arriba de los productos en la portada y en la ficha). Formulario GET: funciona sin
 * JavaScript, deja la búsqueda en la URL y conserva la categoría elegida.
 */
export function SearchForm({ q, category }: Props) {
  return (
    <form
      id="buscar"
      action="/#catalogo"
      method="get"
      role="search"
      className="flex scroll-mt-4 items-center rounded-full border border-brand-line bg-surface shadow-sm focus-within:border-brand-green focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-green motion-safe:transition-colors"
    >
      {category && <input type="hidden" name="categoria" value={category} />}
      <label htmlFor="q" className="sr-only">
        Buscar productos
      </label>
      <span className="grid w-11 shrink-0 place-items-center text-brand-muted" aria-hidden="true">
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
        className="h-12 min-w-0 flex-1 bg-transparent pr-2 text-base outline-none placeholder:text-brand-muted sm:text-sm"
      />
      <button
        type="submit"
        className="m-1 h-10 shrink-0 rounded-full bg-brand-orange px-4 text-sm font-semibold text-brand-charcoal hover:brightness-105 motion-safe:transition motion-safe:active:scale-95"
      >
        Buscar
      </button>
    </form>
  );
}
