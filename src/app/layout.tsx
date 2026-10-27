import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/public";

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

const TITLE = "El Mundo del Plástico — Catálogo";
const DESCRIPTION = "Catálogo de productos de El Mundo del Plástico.";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-[15px]">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-brand-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        {!isSupabaseConfigured && (
          <p className="bg-brand-sand px-4 py-1.5 text-center text-xs text-brand-muted">
            Vista de prueba · los productos y precios son de ejemplo
          </p>
        )}
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
