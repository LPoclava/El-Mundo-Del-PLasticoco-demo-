import Image from "next/image";

/**
 * Logos en sus colores oficiales (public/brand/pagos/), sin filtros: cada uno va sobre blanco para no cambiar cómo se ve.
 * Mercado Pago, de su CDN oficial; Prex, de su sitio; Visa, Mastercard y Naranja X, las versiones vectoriales de
 * Wikimedia Commons.
 */
const METHODS = [
  { name: "Mercado Pago", src: "/brand/pagos/mercado-pago.png", width: 284, height: 74 },
  { name: "Naranja X", src: "/brand/pagos/naranja-x.svg", width: 200, height: 60 },
  { name: "Prex", src: "/brand/pagos/prex.svg", width: 100, height: 56 },
  { name: "Mastercard, débito y crédito", src: "/brand/pagos/mastercard.svg", width: 1000, height: 618 },
  { name: "Visa, débito y crédito", src: "/brand/pagos/visa.svg", width: 1000, height: 325 },
] as const;

/** Grilla compacta para el pie: todas las piezas iguales, sin destacar ningún medio de pago. */
export function PaymentLogos() {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {METHODS.map((method) => (
        <li key={method.name} className="grid h-11 place-items-center rounded-lg bg-white px-2">
          <Image src={method.src} alt={method.name} width={method.width} height={method.height} unoptimized loading="lazy" className="h-6 w-full object-contain" />
        </li>
      ))}
    </ul>
  );
}
