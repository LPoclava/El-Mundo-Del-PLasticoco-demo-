"use client";

import { useSearchParams } from "next/navigation";
import { SearchForm } from "./search-form";

/** Buscador del encabezado: recuerda lo buscado y la categoría elegida (se leen de la URL en el navegador). */
export function HeaderSearch() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("categoria") ?? undefined;
  // La clave vuelve a montar el campo cuando cambia la búsqueda (es un campo no controlado).
  return <SearchForm key={`${q}|${category ?? ""}`} q={q} category={category} />;
}
