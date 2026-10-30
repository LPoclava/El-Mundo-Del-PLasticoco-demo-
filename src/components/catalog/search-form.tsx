type Props = {
  q?: string;
  category?: string;
};

/** Formulario GET: funciona sin JavaScript y deja la búsqueda en la URL. */
export function SearchForm({ q, category }: Props) {
  return (
    <form
      id="buscar"
      action="/#catalogo"
      method="get"
      role="search"
      className="flex scroll-mt-4 items-center rounded-lg border border-brand-line bg-white shadow-sm focus-within:border-brand-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-ink"
    >
      {category && <input type="hidden" name="categoria" value={category} />}
      <label htmlFor="q" className="sr-only">
        Buscar productos
      </label>
      <span className="grid w-11 shrink-0 place-items-center text-brand-muted" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        className="h-[3.25rem] min-w-0 flex-1 bg-transparent pr-2 text-base outline-none placeholder:text-brand-muted"
      />
      <button
        type="submit"
        className="m-1 h-11 rounded-md bg-brand-ink px-4 text-sm font-medium text-white hover:bg-brand-ink/85"
      >
        Buscar
      </button>
    </form>
  );
}
