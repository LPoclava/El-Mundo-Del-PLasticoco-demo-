import Image from "next/image";

/**
 * Logos en sus colores oficiales (public/brand/pagos/), sin filtros: el fondo de cada tarjeta es blanco en los dos
 * temas para que no cambie cómo se ven. Mercado Pago, de su CDN oficial; Prex, de su sitio; Visa, Mastercard y Naranja X,
 * las versiones vectoriales de Wikimedia Commons.
 */
const METHODS = [
  { name: "Mercado Pago", src: "/brand/pagos/mercado-pago.png", width: 284, height: 74, className: "h-8", wide: true },
  { name: "Naranja X", src: "/brand/pagos/naranja-x.svg", width: 200, height: 60, className: "h-7" },
  { name: "Prex", src: "/brand/pagos/prex.svg", width: 100, height: 56, className: "h-8" },
  { name: "Mastercard, débito y crédito", src: "/brand/pagos/mastercard.svg", width: 1000, height: 618, className: "h-8" },
  { name: "Visa, débito y crédito", src: "/brand/pagos/visa.svg", width: 1000, height: 325, className: "h-5" },
] as const;

export function PaymentMethods() {
  return (
    <section id="formas-de-pago" aria-labelledby="pagos-titulo" className="scroll-mt-4">
      <h2 id="pagos-titulo" className="text-2xl font-semibold tracking-tight">Formas de pago</h2>
      <ul className="mt-5 grid grid-cols-2 gap-2.5">
        {METHODS.map((method) => (
          <li
            key={method.name}
            className={`grid h-16 place-items-center rounded-xl border border-black/5 bg-white px-3 shadow-[0_2px_6px_-3px_rgb(0_0_0/0.18)] ${"wide" in method ? "col-span-2" : ""}`}
          >
            <Image src={method.src} alt={method.name} width={method.width} height={method.height} unoptimized loading="lazy" className={`${method.className} w-auto max-w-full`} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-brand-muted">Mastercard y Visa: tarjetas de débito y crédito.</p>
    </section>
  );
}
