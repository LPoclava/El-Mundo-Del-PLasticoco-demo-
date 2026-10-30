/**
 * Textos del catálogo público. ÚNICO lugar donde se editan los títulos y mensajes de las secciones
 * (los componentes los leen de acá, no los repiten).
 */
export const CATALOG_COPY = {
  hero: {
    eyebrow: "Catálogo online",
    title: "Bienvenido a El Mundo del Plástico",
    subtitle: "Mirá el catálogo, buscá lo que necesitás y consultanos cuando quieras.",
  },
  promotions: {
    title: "Promociones y combos",
  },
  categories: {
    title: "Explorá nuestros productos",
    subtitle: "Encontrá todo lo que necesitás para tu hogar, estudio y mucho más.",
    /** Texto del indicador de cada tarjeta de categoría. */
    cta: "Ver productos",
  },
} as const;

/**
 * Color de acento de cada categoría principal (slug estable → naranja o verde). Las que no figuren
 * alternan por posición. Solo cambia el tinte: las tarjetas comparten estructura y proporciones.
 */
export const CATEGORY_TONE: Record<string, "orange" | "green"> = {
  cocina: "orange",
  bano: "green",
  libreria: "green",
  regaleria: "orange",
};
