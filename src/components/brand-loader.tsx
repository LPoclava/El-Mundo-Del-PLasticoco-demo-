import Image from "next/image";

type Props = {
  /** Qué se está esperando, en pocas palabras. Es lo que anuncian los lectores de pantalla. */
  label?: string;
  /**
   * true: ocupa toda la ventana (carga inicial, antes de que exista la estructura de la página).
   * false: ocupa el área de contenido de una pantalla que ya tiene cabecera y menú.
   */
  fullscreen?: boolean;
};

/**
 * Pantalla de carga institucional con el logo oficial (public/brand/logo-horizontal.png, sin redibujar).
 *
 * Usarla SOLO cuando una pantalla completa no puede mostrarse todavía: carga inicial del panel, recuperación
 * de sesión o lectura de los datos que una pantalla entera necesita. Para listas, filtros, botones o campos
 * se usan esqueletos o estados locales («Guardando…»), nunca esta pantalla.
 *
 * No agrega esperas: aparece recién a los 150 ms (si la carga termina antes, no se ve y no hay parpadeo) y
 * desaparece en cuanto el contenido está listo. Con «reducir movimiento» no hay escala ni barra en
 * movimiento: el logo y el texto aparecen quietos.
 */
export function BrandLoader({ label = "Cargando…", fullscreen = false }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`brand-loader grid place-items-center px-6 ${fullscreen ? "min-h-dvh bg-brand-cream" : "min-h-[60dvh]"}`}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/logo-horizontal.png"
          alt=""
          width={256}
          height={94}
          loading="eager"
          className="brand-loader-logo h-auto w-52 sm:w-64"
        />
        <span aria-hidden className="mt-7 block h-1 w-40 overflow-hidden rounded-full bg-brand-line sm:w-48">
          <span className="brand-loader-bar block h-full w-2/5 rounded-full" />
        </span>
        <p className="mt-3 text-sm text-brand-muted">{label}</p>
      </div>
    </div>
  );
}
