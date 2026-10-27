import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  /* config options here */
  // Solo desarrollo: permite abrir el servidor desde el celular en la misma red Wi-Fi.
  // Si el router cambia la IP de la PC, actualizarla acá.
  allowedDevOrigins: ["192.168.1.232"],
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: supabaseImagePatterns() },
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
