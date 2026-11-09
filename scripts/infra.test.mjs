// Pruebas de la infraestructura: cabeceras de seguridad y CSP, SEO técnico, variable de desarrollo y CI.
// Ejecutar: node --test scripts/infra.test.mjs
// Verifican la CONFIGURACIÓN que se entrega. El comportamiento en el navegador (escáner, login, catálogo bajo la CSP)
// se comprobó aparte contra un servidor de producción local; ver docs/despliegue.md.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
/** El texto sin las líneas de comentario: las comprobaciones de "no aparece" miran solo el código. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|#)/;
const code = (text) => text.split("\n").filter((l) => !COMMENT_LINE.test(l)).join("\n");
const SUPABASE = "https://abcdefghijkl.supabase.co";

/** Carga next.config.ts con un entorno dado (cada combinación es un módulo distinto). */
async function loadConfig({ nodeEnv, supabase = SUPABASE, devOrigins } = {}) {
  const saved = { ...process.env };
  process.env.NODE_ENV = nodeEnv;
  if (supabase === null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = supabase;
  if (devOrigins === undefined) delete process.env.ALLOWED_DEV_ORIGINS;
  else process.env.ALLOWED_DEV_ORIGINS = devOrigins;
  try {
    const url = new URL("../next.config.ts", import.meta.url);
    url.searchParams.set("case", `${nodeEnv}-${supabase}-${devOrigins}`);
    const mod = await import(url.href);
    const config = mod.default;
    const rules = await config.headers();
    const headers = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    return { config, rules, headers };
  } finally {
    process.env = saved;
  }
}

const directive = (csp, name) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `))?.slice(name.length + 1).split(/\s+/) ?? [];

describe("cabeceras de seguridad en producción", async () => {
  const { rules, headers } = await loadConfig({ nodeEnv: "production" });

  it("se aplican a todas las rutas", () => {
    assert.equal(rules.length, 1);
    assert.equal(rules[0].source, "/:path*");
  });

  it("llevan las cabeceras básicas", () => {
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.match(headers["Strict-Transport-Security"], /^max-age=\d{7,}$/);
    assert.doesNotMatch(headers["Strict-Transport-Security"], /includeSubDomains|preload/i);
  });

  it("Permissions-Policy deja la cámara a esta página (escáner) y cierra lo demás", () => {
    const p = headers["Permissions-Policy"];
    assert.match(p, /camera=\(self\)/);
    assert.match(p, /microphone=\(\)/);
    assert.match(p, /geolocation=\(\)/);
    assert.match(p, /payment=\(\)/);
    assert.doesNotMatch(p, /camera=\(\)/);
  });
});

describe("CSP en producción", async () => {
  const { headers } = await loadConfig({ nodeEnv: "production" });
  const csp = headers["Content-Security-Policy"];

  it("cierra lo que no se usa", () => {
    assert.deepEqual(directive(csp, "default-src"), ["'self'"]);
    assert.deepEqual(directive(csp, "object-src"), ["'none'"]);
    assert.deepEqual(directive(csp, "frame-ancestors"), ["'none'"]);
    assert.deepEqual(directive(csp, "base-uri"), ["'self'"]);
    assert.deepEqual(directive(csp, "form-action"), ["'self'"]);
    assert.ok(csp.includes("upgrade-insecure-requests"));
  });

  it("scripts: solo este sitio, sin eval y sin orígenes ajenos", () => {
    const s = directive(csp, "script-src");
    assert.ok(s.includes("'self'"));
    assert.ok(!s.includes("'unsafe-eval'"), "no debe haber eval en producción");
    assert.ok(!s.some((x) => /^https?:|\*/.test(x)), `script-src con un origen ajeno: ${s.join(" ")}`);
  });

  it("conexiones: este sitio y Supabase, nada más (sin ws en producción)", () => {
    const c = directive(csp, "connect-src");
    assert.deepEqual(c, ["'self'", SUPABASE]);
  });

  it("imágenes: este sitio, data:, blob: (vista previa de la cámara) y Supabase", () => {
    const i = directive(csp, "img-src");
    for (const need of ["'self'", "data:", "blob:", SUPABASE]) assert.ok(i.includes(need), `falta ${need} en img-src`);
  });

  it("la cámara del escáner puede mostrarse: media-src admite blob:", () => {
    assert.ok(directive(csp, "media-src").includes("blob:"));
  });

  it("tipografías y estilos propios (next/font se sirve desde este sitio)", () => {
    assert.ok(directive(csp, "font-src").includes("'self'"));
    assert.ok(directive(csp, "style-src").includes("'self'"));
  });

  it("sin Supabase configurado no se abre ninguna conexión externa", async () => {
    const { headers: h } = await loadConfig({ nodeEnv: "production", supabase: null });
    assert.deepEqual(directive(h["Content-Security-Policy"], "connect-src"), ["'self'"]);
  });
});

describe("desarrollo", async () => {
  it("la CSP admite eval y ws: para la recarga en caliente, y no fuerza HTTPS ni HSTS", async () => {
    const { headers } = await loadConfig({ nodeEnv: "development" });
    const csp = headers["Content-Security-Policy"];
    assert.ok(directive(csp, "script-src").includes("'unsafe-eval'"));
    assert.ok(directive(csp, "connect-src").includes("ws:"));
    assert.ok(!csp.includes("upgrade-insecure-requests"));
    assert.equal(headers["Strict-Transport-Security"], undefined);
  });

  it("allowedDevOrigins sale de ALLOWED_DEV_ORIGINS y no hay ninguna IP fija en el código", async () => {
    const { config } = await loadConfig({ nodeEnv: "development", devOrigins: " 192.168.1.50 ,, mi-pc.local " });
    assert.deepEqual(config.allowedDevOrigins, ["192.168.1.50", "mi-pc.local"]);
    const none = await loadConfig({ nodeEnv: "development" });
    assert.deepEqual(none.config.allowedDevOrigins, []);
    assert.doesNotMatch(code(read("next.config.ts")), /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });

  it("la variable está documentada en .env.local.example", () => {
    assert.match(read(".env.local.example"), /^ALLOWED_DEV_ORIGINS=/m);
  });

  it("no se anuncia la tecnología del servidor", async () => {
    const { config } = await loadConfig({ nodeEnv: "production" });
    assert.equal(config.poweredByHeader, false);
  });
});

describe("SEO técnico", () => {
  const robots = read("src", "app", "robots.ts");
  const sitemap = read("src", "app", "sitemap.ts");

  it("robots permite el catálogo, cierra el panel y no inventa dominio", () => {
    assert.match(robots, /allow: "\/"/);
    assert.match(robots, /disallow: \["\/panel", "\/panel\/"\]/);
    assert.match(robots, /publicSiteUrl\(\)/);
    assert.doesNotMatch(robots, /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("sitemap usa solo el catálogo público y absolutiza con el dominio configurado", () => {
    assert.match(sitemap, /getCatalogPage/);
    assert.match(sitemap, /if \(!site\) return \[\]/);
    assert.doesNotMatch(code(sitemap), /panel/i);
    assert.doesNotMatch(code(sitemap), /localhost/);
  });

  it("el panel sigue fuera del índice", () => {
    assert.match(read("src", "app", "panel", "layout.tsx"), /robots: \{ index: false, follow: false \}/);
  });

  it("canonical y Open Graph solo se publican con dominio configurado (nunca localhost)", () => {
    const layout = read("src", "app", "layout.tsx");
    assert.match(layout, /\.\.\.\(SITE \? \{ metadataBase: SITE \} : \{\}\)/);
    assert.match(layout, /SITE \? \{ images:/);
    assert.match(read("src", "app", "(site)", "page.tsx"), /publicSiteUrl\(\) \? \{ alternates: \{ canonical: "\/" \} \}/);
    assert.ok(existsSync(join(ROOT, "public", "brand", "og-image.png")));
  });
});

describe("integración continua", () => {
  const ci = read(".github", "workflows", "ci.yml");

  it("corre en pull requests y en main, con permisos de solo lectura", () => {
    assert.match(ci, /pull_request:/);
    assert.match(ci, /branches: \[main\]/);
    assert.match(ci, /permissions:\s*\n\s+contents: read/);
  });

  it("instala de forma reproducible y corre tipos, lint, pruebas y build, en ese orden", () => {
    const steps = ["npm ci", "npx tsc --noEmit", "npm run lint", "npm test", "npm run build"].map((s) => ci.indexOf(`run: ${s}`));
    assert.ok(steps.every((i) => i > 0), `faltan pasos: ${steps}`);
    assert.deepEqual([...steps].sort((a, b) => a - b), steps, "el orden de los pasos cambió");
  });

  it("los comandos existen en package.json", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    for (const name of ["lint", "test", "build"]) assert.ok(scripts[name], `falta el script ${name}`);
  });

  it("usa la versión de Node del repositorio y no despliega ni usa secretos", () => {
    assert.match(ci, /node-version-file: \.nvmrc/);
    assert.match(read(".nvmrc"), /^\d+/);
    assert.doesNotMatch(code(ci), /secrets\.|vercel|deploy/i);
  });

  it("la compilación no depende del Supabase real", () => {
    assert.match(ci, /NEXT_PUBLIC_SUPABASE_URL: ""/);
    assert.match(ci, /NEXT_PUBLIC_SUPABASE_ANON_KEY: ""/);
  });
});
