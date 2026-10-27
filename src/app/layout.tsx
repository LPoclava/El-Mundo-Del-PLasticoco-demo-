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
        {children}
      </body>
    </html>
  );
}
