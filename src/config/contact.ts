/**
 * Datos de contacto oficiales del negocio. ÚNICO lugar donde se editan.
 *
 * PENDIENTE: todos los valores están en `null` hasta confirmarlos con el negocio.
 * Un canal en `null` no se muestra al público (en desarrollo aparece deshabilitado).
 *
 * Formatos:
 * - whatsapp / phone: número en formato internacional, solo dígitos o con + (ej.: código de país + área + número).
 * - instagramUrl / facebookUrl: dirección completa que empiece con https://
 */
export const CONTACT: {
  whatsapp: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  /** Dirección del local, tal como se quiere mostrar. null = no se muestra (falta confirmarla con el negocio). */
  address: string | null;
  /** Horarios de atención, una línea por renglón. null = no se muestra (falta confirmarlos con el negocio). */
  hours: string[] | null;
} = {
  whatsapp: "5492902404916",
  phone: "542902404916",
  instagramUrl: null,
  facebookUrl: "https://www.facebook.com/plasticosnavarrete",
  // PENDIENTE: no hay dirección ni horarios confirmados. No completar con datos supuestos.
  address: null,
  hours: null,
};
