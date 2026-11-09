import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

/**
 * El catálogo público se puede indexar; el panel no (además de esto, sus páginas llevan noindex).
 * El sitemap solo se anuncia con un dominio configurado: nunca se inventa una dirección.
 */
export default function robots(): MetadataRoute.Robots {
  const site = publicSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/panel/"] }],
    ...(site ? { sitemap: new URL("/sitemap.xml", site).toString() } : {}),
  };
}
