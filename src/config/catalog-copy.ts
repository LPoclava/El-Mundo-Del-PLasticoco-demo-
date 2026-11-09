/**
 * Textos del catálogo público. ÚNICO lugar donde se editan los títulos y mensajes de las secciones
 * (los componentes los leen de acá, no los repiten).
 */
export const CATALOG_COPY = {
  intro: {
    /** La segunda parte va resaltada en naranja. */
    title: ["Todo lo que necesitás,", "en un mismo lugar."],
    text: "Somos un negocio familiar, comprometido con brindarte variedad, calidad y la mejor atención para tu hogar, tu estudio y mucho más.",
    concept: "Un mundo para descubrir",
  },
  /** Sección «descubrimiento» de la portada: un vistazo real a cada rubro. */
  discovery: {
    kicker: "Un vistazo por rubro",
    title: "Recorré el local desde tu casa",
    text: "Un poco de cada rubro, para que encuentres todo lo que necesitás en un mismo lugar. Sumá lo que te guste al pedido y lo coordinamos por WhatsApp.",
    seeAll: "Ver todo",
  },
  promotions: {
    title: "Promociones",
  },
  categories: {
    title: "Explorá nuestras categorías",
  },
  catalog: {
    title: "Nuestro catálogo",
    howToBuy: "Elegís lo que necesitás, nos consultás por WhatsApp y coordinamos tu compra.",
  },
  benefits: {
    title: "Por qué elegirnos",
  },
} as const;

/**
 * Numeración gráfica de los tickets (identidad visual, NO identificadores de la base). Va por slug estable: «bano» es
 * el slug histórico de Limpieza. Una categoría nueva toma el número de su posición.
 */
export const CATEGORY_TICKET: Record<string, string> = {
  cocina: "001",
  bano: "002",
  limpieza: "002",
  regaleria: "003",
  libreria: "004",
};
