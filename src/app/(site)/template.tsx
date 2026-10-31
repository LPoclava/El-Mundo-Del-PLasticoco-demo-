/**
 * Se vuelve a montar en cada navegación entre páginas públicas: entrada breve del contenido. Parte de un
 * estado ya visible (no de opacidad 0), así una animación que no llega a correr nunca deja la página vacía.
 * Con «reducir movimiento» no hay animación.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
