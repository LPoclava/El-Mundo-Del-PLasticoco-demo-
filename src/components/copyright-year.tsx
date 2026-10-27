import { cacheLife } from "next/cache";

/** Año actual calculado en el servidor y cacheado un día (evita leer la hora al prerenderizar). */
export async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
