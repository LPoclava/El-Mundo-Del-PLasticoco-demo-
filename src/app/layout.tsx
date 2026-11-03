import type { Metadata, Viewport } from "next";
import { Geist, Nunito } from "next/font/google";
import { publicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Títulos y precios del catálogo: redondeada y comercial, de la familia del logo. El cuerpo y el panel siguen en Geist.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["800"],
});

const SITE = publicSiteUrl();
const TITLE = "El Mundo del Plástico — Todo lo que necesitás, en un mismo lugar";
const DESCRIPTION =
  "Negocio familiar con variedad de artículos para tu hogar, tu estudio y mucho más: cocina, limpieza, regalería y librería. Mirá el catálogo y consultanos por WhatsApp.";

export const metadata: Metadata = {
  ...(SITE ? { metadataBase: SITE } : {}),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "El Mundo del Plástico",
    title: TITLE,
    description: DESCRIPTION,
    // La imagen necesita una dirección absoluta: sin dominio configurado se omite (nunca sale con localhost).
    ...(SITE ? { images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "El Mundo del Plástico" }] } : {}),
  },
};

/** Barra del navegador en celulares; src/components/theme-toggle.tsx la ajusta a la elección del usuario. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121a16" },
  ],
};

/**
 * Aplica el tema ANTES de que el navegador pinte (evita el destello del tema equivocado): usa la preferencia
 * guardada y, si no hay, la del sistema operativo. También marca si corresponde la pantalla de carga: primera entrada
 * de la sesión a la portada, sin búsqueda ni filtros y sin movimiento reducido (una carga completa; la navegación
 * interna no pasa por acá), y atiende «saltar» con cualquier tecla, toque o clic aunque React todavía no haya cargado.
 * Es un script chico y bloqueante a propósito.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("mp-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t}catch(e){}try{if(location.pathname==="/"&&!location.search&&!location.hash&&!sessionStorage.getItem("mp-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("mp-intro","1");d.setAttribute("data-intro","play");var s=function(e){if(e.key==="Tab"||e.key==="Shift")return;if(d.getAttribute("data-intro")==="play")d.setAttribute("data-intro","leaving")};["keydown","pointerdown","click","wheel","touchstart"].forEach(function(n){addEventListener(n,s,{passive:true})})}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script cambia data-theme antes de que React hidrate.
    <html lang="es-AR" suppressHydrationWarning data-scroll-behavior="smooth" className={`${geistSans.variable} ${nunito.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[15px]">
        {children}
      </body>
    </html>
  );
}
