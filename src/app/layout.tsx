import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Dirección pública del sitio (ver .env.local.example); necesaria para que la imagen
// de vista previa (WhatsApp, redes) tenga una URL absoluta.
function siteUrl(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

const TITLE = "El Mundo del Plástico — Todo lo que necesitás, en un mismo lugar";
const DESCRIPTION =
  "Negocio familiar con variedad de artículos para tu hogar, tu estudio y mucho más: cocina, limpieza, regalería y librería. Mirá el catálogo y consultanos por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "El Mundo del Plástico",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      { url: "/brand/og-image.png", width: 1200, height: 630, alt: "El Mundo del Plástico" },
    ],
  },
};

/**
 * Aplica el tema ANTES de que el navegador pinte (evita el destello del tema equivocado): usa la preferencia
 * guardada y, si no hay, la del sistema operativo. También marca si corresponde la pantalla de carga: primera entrada
 * de la sesión a la portada, sin búsqueda ni filtros (una carga completa; la navegación interna no pasa por acá).
 * Es un script chico y bloqueante a propósito.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("mp-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t}catch(e){}try{if(location.pathname==="/"&&!location.search&&!location.hash&&!sessionStorage.getItem("mp-intro"))d.setAttribute("data-intro","")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script cambia data-theme antes de que React hidrate.
    <html lang="es-AR" suppressHydrationWarning data-scroll-behavior="smooth" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[15px]">
        {children}
      </body>
    </html>
  );
}
