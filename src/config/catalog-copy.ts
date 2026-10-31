/**
 * Textos del catálogo público. ÚNICO lugar donde se editan los títulos y mensajes de las secciones
 * (los componentes los leen de acá, no los repiten).
 */
export const CATALOG_COPY = {
  hero: {
    /** Título de la portada (solo para lectores de pantalla y buscadores; no hay bloque de bienvenida). */
    title: "Bienvenido a El Mundo del Plástico",
  },
  promotions: {
    title: "Promociones y combos",
  },
  categories: {
    title: "Explorá nuestros productos",
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
