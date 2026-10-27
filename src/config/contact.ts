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
} = {
  whatsapp: null,
  phone: null,
  instagramUrl: null,
  facebookUrl: null,
};
