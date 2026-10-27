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

export const metadata: Metadata = {
  title: "El Mundo del Plástico — Catálogo",
  description: "Catálogo de productos de El Mundo del Plástico.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-[15px]">
        {!isSupabaseConfigured && (
          <p className="bg-brand-sand px-4 py-1.5 text-center text-xs text-brand-ink/70">
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
