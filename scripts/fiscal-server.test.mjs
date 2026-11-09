// Pruebas del circuito fiscal del servidor (sin red, sin base): permisos, validación, respuestas y secretos.
// Ejecutar: node --test scripts/fiscal-server.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { readFiscalConfig, readFiscalSecrets, REQUIRED_ENV } from "../src/lib/fiscal/config.ts";
import { bearerToken, handleList, handleProcess, handleRequest, handleStatus, isUuid } from "../src/lib/fiscal/handlers.ts";
import { FiscalDbError, redact } from "../src/lib/fiscal/service.ts";
import { createArcaProvider } from "../src/lib/fiscal/provider.ts";

const root = join(import.meta.dirname, "..");
const TOKEN = "t".repeat(40);
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const cfg = (over = {}) => ({ missing: [], configured: true, environment: "homologacion", productionAllowed: false, ...over });

/** Dependencias falsas: quién es desarrollador y qué hace la «base». */
function deps({ developer = true, config = cfg(), db = {} } = {}) {
  const calls = [];
  return {
    calls,
    config: () => config,
    isDeveloper: async (token) => {
      calls.push(["isDeveloper", token]);
      return developer;
    },
    service: () => ({
      config,
      provider: createArcaProvider(),
      db: {
        getSettings: async () => ({ productionEnabled: false }),
        listDocuments: async () => [{ id: U(1), saleId: U(2), environment: "homologacion", status: "pendiente", lastError: null }],
        getDocument: async () => null,
        requestIssue: async (...args) => { calls.push(["requestIssue", ...args]); return { id: U(1), status: "pendiente", environment: args[2], created: true }; },
        transition: async () => ({ status: "pendiente" }),
        logEvent: async () => undefined,
        ...db,
      },
    }),
  };
}

const req = (method, path, { token = TOKEN, body, headers = {} } = {}) =>
  new Request(`https://sitio.test${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", ...headers },
    ...(body !== undefined && method !== "GET" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });

describe("acceso: solo desarrolladores autorizados", () => {
  const all = [
    ["status", (d, r) => handleStatus(r, d), () => req("GET", "/api/fiscal/status", { token: null })],
    ["documents", (d, r) => handleList(r, d), () => req("GET", "/api/fiscal/documents", { token: null })],
    ["request", (d, r) => handleRequest(r, d), () => req("POST", "/api/fiscal/request", { token: null, body: {} })],
    ["process", (d, r) => handleProcess(r, d), () => req("POST", "/api/fiscal/process", { token: null, body: {} })],
  ];

  for (const [name, run, make] of all) {
    it(`${name}: sin sesión es 401 y no consulta nada`, async () => {
      const d = deps();
      const res = await run(d, make());
      assert.equal(res.status, 401);
      assert.equal(d.calls.length, 0);
    });
    it(`${name}: una cuenta que no es de desarrollo (por ejemplo, el CEO del comercio) es 403`, async () => {
      const d = deps({ developer: false });
      const r = req(name === "status" || name === "documents" ? "GET" : "POST", `/api/fiscal/${name}`, { body: {} });
      const res = await run(d, r);
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: "No autorizado" });
      assert.ok(!d.calls.some((c) => c[0] === "requestIssue"), "no llegó a la base");
    });
    it(`${name}: token inválido o vencido es 401; si la verificación falla es 503 (no se asume permiso)`, async () => {
      const bad = { ...deps(), isDeveloper: async () => null };
      const r = req(name === "status" || name === "documents" ? "GET" : "POST", `/api/fiscal/${name}`, { body: {} });
      assert.equal((await run(bad, r)).status, 401);
      const boom = { ...deps(), isDeveloper: async () => { throw new Error("caído"); } };
      const r2 = req(name === "status" || name === "documents" ? "GET" : "POST", `/api/fiscal/${name}`, { body: {} });
      assert.equal((await run(boom, r2)).status, 503);
    });
  }

  it("el token tiene que tener forma de token (no se acepta cualquier cosa en la cabecera)", () => {
    assert.equal(bearerToken(req("GET", "/x", { token: TOKEN })), TOKEN);
    for (const t of ["corto", "con espacios " + "x".repeat(30), "x".repeat(5000), "a;b".repeat(20)]) assert.equal(bearerToken(req("GET", "/x", { token: t })), null);
    assert.equal(bearerToken(new Request("https://a.test", { headers: { authorization: "Basic abc" } })), null);
  });

  it("se verifica con la sesión de la persona (is_developer) y la cuenta de desarrollo pasa", async () => {
    const d = deps();
    const res = await handleStatus(req("GET", "/api/fiscal/status"), d);
    assert.equal(res.status, 200);
    assert.deepEqual(d.calls[0], ["isDeveloper", TOKEN]);
  });
});

describe("solicitud: validación e idempotencia", () => {
  const ok = { saleId: U(2), idempotencyKey: U(3) };

  it("registra la solicitud (201) y repetirla devuelve la misma sin crear otra (200)", async () => {
    const d = deps();
    const first = await handleRequest(req("POST", "/api/fiscal/request", { body: ok }), d);
    assert.equal(first.status, 201);
    const again = await handleRequest(req("POST", "/api/fiscal/request", { body: ok }), deps({ db: { requestIssue: async () => ({ id: U(1), status: "pendiente", environment: "homologacion", created: false }) } }));
    assert.equal(again.status, 200);
    assert.equal((await again.json()).created, false);
  });

  it("usa homologación por defecto y rechaza entornos, identificadores y cuerpos inválidos", async () => {
    const d = deps();
    await handleRequest(req("POST", "/api/fiscal/request", { body: ok }), d);
    assert.equal(d.calls.find((c) => c[0] === "requestIssue")[3], "homologacion");
    for (const body of [{}, { saleId: "x", idempotencyKey: U(3) }, { saleId: U(2), idempotencyKey: "x" }, { ...ok, environment: "otro" }, [], "no json", { ...ok, environment: 5 }]) {
      const res = await handleRequest(req("POST", "/api/fiscal/request", { body }), deps());
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it("cuerpos enormes se rechazan antes de procesarlos", async () => {
    const res = await handleRequest(req("POST", "/api/fiscal/request", { body: JSON.stringify({ ...ok, relleno: "x".repeat(5000) }) }), deps());
    assert.equal(res.status, 413);
  });

  it("producción: el servidor la rechaza sin llegar a la base mientras su llave esté apagada", async () => {
    const d = deps();
    const res = await handleRequest(req("POST", "/api/fiscal/request", { body: { ...ok, environment: "produccion" } }), d);
    assert.equal(res.status, 409);
    assert.ok(!d.calls.some((c) => c[0] === "requestIssue"));
  });

  it("los errores de la base se traducen sin filtrar su mensaje", async () => {
    const secretMessage = "detalle interno: clave abc123";
    for (const [code, status] of [["42501", 403], ["22023", 400], ["23505", 409], ["55000", 409], ["XX000", 500]]) {
      const d = deps({ db: { requestIssue: async () => { throw new FiscalDbError(code, secretMessage); } } });
      const res = await handleRequest(req("POST", "/api/fiscal/request", { body: ok }), d);
      assert.equal(res.status, status, code);
      assert.doesNotMatch(await res.text(), /abc123|detalle interno/);
    }
  });
});

describe("estado, listado y proceso", () => {
  it("el estado informa qué falta (nombres) y las dos llaves de producción, sin ningún valor", async () => {
    const res = await handleStatus(req("GET", "/api/fiscal/status"), deps({ config: cfg({ configured: false, missing: ["FISCAL_ARCA_CERT"] }) }));
    const body = await res.json();
    assert.deepEqual(body.missing, ["FISCAL_ARCA_CERT"]);
    assert.equal(body.configured, false);
    assert.equal(body.productionEnabled, false);
    assert.equal(body.productionServerKey, false);
    assert.equal(body.productionDatabaseKey, false);
    assert.equal(body.emission, "no-implementada");
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  it("producción solo cuenta como habilitada si las DOS llaves están encendidas", async () => {
    const both = deps({ config: cfg({ productionAllowed: true }), db: { getSettings: async () => ({ productionEnabled: true }) } });
    assert.equal((await (await handleStatus(req("GET", "/api/fiscal/status"), both)).json()).productionEnabled, true);
    const onlyServer = deps({ config: cfg({ productionAllowed: true }) });
    assert.equal((await (await handleStatus(req("GET", "/api/fiscal/status"), onlyServer)).json()).productionEnabled, false);
  });

  it("el listado valida el filtro y devuelve solo campos públicos", async () => {
    assert.equal((await handleList(req("GET", "/api/fiscal/documents?venta=nada"), deps())).status, 400);
    const res = await handleList(req("GET", `/api/fiscal/documents?venta=${U(2)}`), deps());
    const body = await res.json();
    assert.deepEqual(Object.keys(body.documents[0]).sort(), ["environment", "id", "lastError", "saleId", "status"]);
  });

  it("procesar valida el identificador y reconoce inexistente (404) y sin credenciales (409, solo nombres)", async () => {
    assert.equal((await handleProcess(req("POST", "/api/fiscal/process", { body: { documentId: "x" } }), deps())).status, 400);
    assert.equal((await handleProcess(req("POST", "/api/fiscal/process", { body: { documentId: U(1), retry: "si" } }), deps())).status, 400);
    assert.equal((await handleProcess(req("POST", "/api/fiscal/process", { body: { documentId: U(1) } }), deps())).status, 404);
    const pending = { getDocument: async () => ({ id: U(1), saleId: U(2), environment: "homologacion", status: "pendiente", lastError: null }) };
    const res = await handleProcess(req("POST", "/api/fiscal/process", { body: { documentId: U(1) } }), deps({ config: cfg({ configured: false, missing: ["FISCAL_ARCA_KEY"] }), db: pending }));
    assert.equal(res.status, 409);
    assert.deepEqual((await res.json()).missing, ["FISCAL_ARCA_KEY"]);
  });
});

describe("secretos y configuración", () => {
  it("la configuración dice qué falta y nunca devuelve valores", () => {
    const empty = readFiscalConfig({});
    assert.deepEqual(empty.missing, [...REQUIRED_ENV]);
    assert.equal(empty.configured, false);
    assert.equal(empty.productionAllowed, false);
    assert.equal(empty.environment, "homologacion");
    const env = { FISCAL_ARCA_CUIT: "20123456789", FISCAL_ARCA_POINT_OF_SALE: "3", FISCAL_ARCA_CERT: "CERT-SECRETO", FISCAL_ARCA_KEY: "CLAVE-SECRETA" };
    const full = readFiscalConfig(env);
    assert.equal(full.configured, true);
    assert.doesNotMatch(JSON.stringify(full), /SECRETO|SECRETA|20123456789/);
  });

  it("producción solo se admite con FISCAL_PRODUCTION_ALLOWED=1 exacto y el entorno por defecto es homologación", () => {
    assert.equal(readFiscalConfig({ FISCAL_PRODUCTION_ALLOWED: "true" }).productionAllowed, false);
    assert.equal(readFiscalConfig({ FISCAL_PRODUCTION_ALLOWED: "1" }).productionAllowed, true);
    assert.equal(readFiscalConfig({ FISCAL_ARCA_ENV: "cualquier cosa" }).environment, "homologacion");
    assert.equal(readFiscalConfig({ FISCAL_ARCA_ENV: "produccion" }).environment, "produccion");
  });

  it("las credenciales solo se entregan completas y vacías cuentan como faltantes", () => {
    assert.equal(readFiscalSecrets({ FISCAL_ARCA_CUIT: "1", FISCAL_ARCA_POINT_OF_SALE: " ", FISCAL_ARCA_CERT: "c", FISCAL_ARCA_KEY: "k" }), null);
  });

  it("redact quita campos con nombre de credencial, también anidados y en listas", () => {
    const out = redact({ ok: 1, token: "x", sign: "y", anidado: { private_key: "z", dato: 2 }, lista: [{ clave: "q", n: 3 }], certificado: "c", Password: "p" });
    assert.deepEqual(out, { ok: 1, anidado: { dato: 2 }, lista: [{ n: 3 }] });
  });

  it("isUuid acepta solo identificadores bien formados", () => {
    assert.ok(isUuid(U(1)));
    for (const v of ["", "x", 5, null, U(1) + "0", U(1).replaceAll("-", "")]) assert.equal(isUuid(v), false);
  });
});

describe("garantías de código", () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  const fiscalSrc = files(join(root, "src", "lib", "fiscal")).map((p) => [relative(root, p), readFileSync(p, "utf8")]);
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("ninguna variable fiscal ni secreto usa el prefijo público NEXT_PUBLIC_ y no se usa service_role", () => {
    for (const [name, src] of fiscalSrc) {
      const c = code(src);
      assert.doesNotMatch(c, /NEXT_PUBLIC_[A-Z_]*FISCAL|FISCAL_[A-Z_]*NEXT_PUBLIC/, name);
      assert.doesNotMatch(c, /service_role|SERVICE_ROLE/, name);
    }
    assert.doesNotMatch(readFileSync(join(root, ".env.local.example"), "utf8"), /NEXT_PUBLIC_FISCAL/);
  });

  it("el adaptador de ARCA no abre conexiones: no hay fetch, http ni sockets en el circuito fiscal", () => {
    for (const [name, src] of fiscalSrc) assert.doesNotMatch(code(src), /\bfetch\(|node:https?|node:net|XMLHttpRequest|WebSocket|soap|wsfe|wsaa\.afip|arca\.gob/i, name);
  });

  it("ninguna pantalla (componente) importa el circuito fiscal del servidor", () => {
    for (const p of files(join(root, "src", "components")).concat(files(join(root, "src", "app")).filter((f) => !f.includes(`${join("app", "api")}`)))) {
      if (!/\.(ts|tsx)$/.test(p)) continue;
      assert.doesNotMatch(readFileSync(p, "utf8"), /lib\/fiscal/, relative(root, p));
    }
  });

  it("las rutas son delgadas: solo llaman a los manejadores con las dependencias reales", () => {
    for (const [name, method, handler] of [["status", "GET", "handleStatus"], ["documents", "GET", "handleList"], ["request", "POST", "handleRequest"], ["process", "POST", "handleProcess"]]) {
      const src = readFileSync(join(root, "src", "app", "api", "fiscal", name, "route.ts"), "utf8");
      assert.ok(src.includes(`export async function ${method}(`) && src.includes(`${handler}(request, fiscalDeps())`), name);
      assert.doesNotMatch(src, /process\.env|createClient/, name);
    }
  });

  it("la venta no depende del circuito fiscal: ni el punto de venta ni el comprobante interno lo mencionan", () => {
    for (const p of files(join(root, "src", "lib", "pos")).concat(files(join(root, "src", "components", "panel", "pos")))) {
      assert.doesNotMatch(readFileSync(p, "utf8"), /fiscal_request|fiscal_transition|api\/fiscal|lib\/fiscal/, relative(root, p));
    }
  });

  it("los certificados y claves están ignorados por Git", () => {
    const ignore = readFileSync(join(root, ".gitignore"), "utf8");
    for (const ext of ["*.pem", "*.p12", "*.pfx", "*.crt", "*.key"]) assert.ok(ignore.includes(ext), ext);
  });
});
