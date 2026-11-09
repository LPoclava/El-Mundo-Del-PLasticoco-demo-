import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origen (https://xxxx.supabase.co) del proyecto de Supabase, o null si no está configurado. */
function supabaseOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

// Permite optimizar las fotos del bucket público de Supabase Storage.
function supabaseImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const { protocol, hostname } = new URL(raw);
    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Política de seguridad de contenido, SIN nonces: con `cacheComponents` y `partialPrefetching` las páginas se
 * prerenderizan y un nonce por pedido obligaría a renderizarlo todo en cada visita (la guía de Next 16 lo declara
 * incompatible con PPR). Por eso script-src admite 'unsafe-inline': hacen falta el script del tema (layout) y los de
 * arranque de Next. Lo que sí queda cerrado: ningún script de otro origen, sin eval en producción, sin plugins,
 * sin embeber el sitio en otro y conexiones solo a este sitio y a Supabase.
 * Para cuidar la cámara del escáner: blob: en media/img (vista previa) y nada de micrófono (ver Permissions-Policy).
 */
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    // En desarrollo, ws: y wss: permiten la recarga en caliente (también desde el celular por la red local).
    "connect-src": ["'self'", ...(supabase ? [supabase] : []), ...(isDev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * Cabeceras de seguridad para todas las rutas.
 * - Permissions-Policy: el escáner y la foto del producto usan la cámara de esta misma página (camera=(self)); el resto
 *   de las funciones sensibles queda cerrado. El micrófono no se usa (getUserMedia pide solo video).
 * - Strict-Transport-Security: solo en producción (HTTPS) y sin includeSubDomains ni preload, que son difíciles de revertir.
 */
function securityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  ];
}

// Solo desarrollo: direcciones desde las que se puede abrir el servidor (por ejemplo, el celular en la misma red
// Wi-Fi). Se definen en .env.local con ALLOWED_DEV_ORIGINS=192.168.1.50,otra.local (ver .env.local.example).
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins,
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseImagePatterns(),
    // 75 para fotos de producto; 90 para ilustraciones y banners, que ya llegan comprimidos en WebP:
    // recomprimirlos a 75 marcaba bordes y degradados (se veían pixelados en el celular).
    qualities: [75, 90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
