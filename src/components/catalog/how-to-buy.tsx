import { generalInquiryHref } from "@/lib/contact";
import { ContactIcon } from "@/components/contact/contact-icon";

const STEPS = [
  { title: "Explorá el catálogo", text: "Buscá o entrá por categoría.", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4.5 4.5" },
  { title: "Elegí el producto", text: "Mirá fotos, precio y opciones.", icon: "M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Zm4 0V6a3 3 0 0 1 6 0v1" },
  { title: "Consultanos por WhatsApp", text: "Con un toque se abre el chat.", icon: "M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5Z" },
  { title: "Coordiná compra y retiro", text: "Acordás con nosotros cómo y cuándo.", icon: "M20 6 9 17l-5-5" },
] as const;

/**
 * Cómo comprar, en cuatro pasos. No hay pago online: la compra y el retiro se coordinan por WhatsApp.
 * Sin dirección ni horarios (no hay datos confirmados): no se inventa ninguno.
 */
export function HowToBuy() {
  const whatsapp = generalInquiryHref("Hola, quería hacer una consulta.");
  return (
    <section aria-labelledby="como-comprar" className="mt-10 border-t border-brand-line pt-6 lg:pt-8">
      <h2 id="como-comprar" className="text-lg font-semibold tracking-tight sm:text-xl">Cómo comprar</h2>
      <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-green/10 text-brand-green-ink">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={step.icon} />
              </svg>
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium leading-snug">
                <span className="sr-only">Paso {i + 1}: </span>
                {step.title}
              </span>
              <span className="mt-0.5 block text-brand-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-green/50 bg-surface px-4 text-sm font-medium text-brand-green-ink hover:bg-brand-green/10"
        >
          <ContactIcon id="whatsapp" className="size-5" />
          Escribinos por WhatsApp
        </a>
      )}
    </section>
  );
}
