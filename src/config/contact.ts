/**
 * Datos de contacto oficiales del negocio. ÚNICO lugar donde se editan.
 *
 * Un canal en `null` no se muestra al público (en desarrollo aparece deshabilitado).
 *
 * Formatos:
 * - whatsapp / phone: número en formato internacional, solo dígitos o con + (ej.: código de país + área + número).
 * - instagramUrl / facebookUrl: dirección completa que empiece con https://
 *
 * Origen de la dirección y el horario: volante del negocio (Logo/475254990_...jpg). La localidad no figura en el
 * volante: se dedujo del barrio Los Lupinos y de la característica 2902 (Río Turbio). CONFIRMAR con el negocio.
 */
export const CONTACT: {
  whatsapp: string | null;
  phone: string | null;
  /** PENDIENTE: el negocio todavía no tiene cuenta configurada; con null no aparece ningún botón. */
  instagramUrl: string | null;
  facebookUrl: string | null;
  /** Dirección del local, tal como se quiere mostrar. null = no se muestra. */
  address: string | null;
  /** Localidad y provincia. null = no se muestra. */
  locality: string | null;
  /** Horarios de atención, una línea por renglón. null = no se muestra. */
  hours: string[] | null;
  /** Coordenadas de la localidad para el marcador del globo. null = el globo no lleva marcador. */
  location: { lat: number; lng: number } | null;
} = {
  whatsapp: "5492902404916",
  phone: "542902404916",
  instagramUrl: null,
  facebookUrl: "https://www.facebook.com/plasticosnavarrete",
  address: "Bº Los Lupinos, Mza. 103, Lote 1",
  locality: "Río Turbio, Santa Cruz",
  hours: ["Lunes a sábado de 14 a 20 hs"],
  // Río Turbio: 51°32′S 72°18′O.
  location: { lat: -51.533, lng: -72.3 },
};
