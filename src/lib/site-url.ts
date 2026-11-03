/**
 * Dirección pública del sitio, para enlaces canónicos, vista previa en redes y el enlace del mensaje de WhatsApp.
 * Sale de NEXT_PUBLIC_SITE_URL y, en Vercel, del dominio de producción que informa la plataforma. Sin ninguno de los
 * dos devuelve null: quien la usa omite esos enlaces en vez de publicar una dirección de localhost.
 */
export function publicSiteUrl(): URL | null {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (vercel ? `https://${vercel}` : "");
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
