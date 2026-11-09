// Circuito fiscal del servidor contra la base real (PGlite): el servicio de src/lib/fiscal con las funciones SQL de verdad.
// Los proveedores que «emiten» son falsos y SOLO existen en esta prueba (con un CAE inventado que jamás sale de acá): en la
// aplicación el único proveedor es el de ARCA sin integrar, que no emite nada.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ID, CAT1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAdmin } from "./helpers.mjs";
import { FiscalDbError, processDocument, requestIssue } from "../../src/lib/fiscal/service.ts";
import { createArcaProvider } from "../../src/lib/fiscal/provider.ts";

let db;
const K = () => crypto.randomUUID();
const DEV = ID.gerente; // de desarrollo, con rol de comercio «gerente»
const CEO = ID.ceo2; // CEO del comercio SIN acceso de desarrollo
const SALE = "70000000-0000-4000-8000-0000000000c1";
const PROD = "50000000-0000-4000-8000-0000000000c1";
const VAR = "60000000-0000-4000-8000-0000000000c1";

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029");
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029");
  await seedCatalog(db);
  await db.exec(`
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente Dev', 'gerente', true),
      ('${ID.empleado}', 'Empleada', 'empleado', true);
    insert into public.developer_access (user_id, note) values ('${ID.gerente}', 'prueba');
  `);
});

async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}

/** Cada operación corre en un punto de guardado: un error de la base no aborta la transacción de la prueba. */
function fiscalDb(q) {
  let n = 0;
  const call = async (sql, params) => {
    const sp = `sp${++n}`;
    await q(`savepoint ${sp}`);
    try {
      const r = await q(sql, params);
      await q(`release savepoint ${sp}`);
      return r;
    } catch (e) {
      await q(`rollback to savepoint ${sp}`);
      throw new FiscalDbError(e.code ?? "XX000", e.message);
    }
  };
  const toDoc = (r) => ({ id: r.id, saleId: r.sale_id, environment: r.environment, status: r.status, lastError: r.last_error });
  return {
    async getDocument(id) {
      const r = await call("select id, sale_id, environment, status, last_error from public.fiscal_documents where id = $1", [id]);
      return r.rows[0] ? toDoc(r.rows[0]) : null;
    },
    async listDocuments(saleId) {
      const r = await call("select id, sale_id, environment, status, last_error from public.fiscal_documents where $1::uuid is null or sale_id = $1", [saleId]);
      return r.rows.map(toDoc);
    },
    async getSettings() {
      const r = await call("select production_enabled from public.fiscal_settings");
      return { productionEnabled: Boolean(r.rows[0]?.production_enabled) };
    },
    async requestIssue(saleId, key, env) {
      return (await call("select public.fiscal_request_issue($1, $2, $3) as r", [saleId, key, env])).rows[0].r;
    },
    async transition(id, to, note = null, result = null) {
      const r = await call("select public.fiscal_transition($1, $2, $3, $4::jsonb) as r", [id, to, note, result ? JSON.stringify(result) : null]);
      return { status: r.rows[0].r.status };
    },
    async logEvent(id, kind, payload = null, note = null) {
      await call("select public.fiscal_log_event($1, $2, $3::jsonb, $4)", [id, kind, payload ? JSON.stringify(payload) : null, note]);
    },
  };
}

const cfg = (over = {}) => ({ missing: [], configured: true, environment: "homologacion", productionAllowed: false, ...over });

/** Proveedor falso con contador de llamadas. */
const fake = (impl) => {
  const p = { name: "falso-de-prueba", calls: 0, async issue(r) { p.calls++; return impl(r); } };
  return p;
};
const AUTHORIZED = () => ({ kind: "issued", docType: 11, pointOfSale: 1, number: 7, cae: "70123456789012", caeExpiresOn: "2030-01-31", raw: { resultado: "A", token: "NO-DEBE-GUARDARSE" } });

const withSale = (fn) =>
  asAdmin(db, async (q) => {
    await q(`insert into public.products (id, name, category_id, barcode, publish_enabled) values ('${PROD}', 'Balde', '${CAT1}', '7794444000011', false)`);
    await q(`insert into public.product_variants (id, product_id, price, position, stock) values ('${VAR}', '${PROD}', 1000, 0, 10)`);
    await q(`insert into public.sales (id, user_id, user_name, payment_method, total, idempotency_key) values ('${SALE}', '${ID.empleado}', 'Empleada', 'efectivo', 1000, '${K()}')`);
    await login(q, DEV);
    return fn(q, fiscalDb(q));
  });

const events = async (q, id) => (await q("select kind, from_status, to_status, payload, note from public.fiscal_events where document_id = $1 order by id", [id])).rows;

describe("permisos en la base (segunda barrera)", () => {
  it("el CEO del comercio no puede pedir ni leer nada, aunque el servidor se equivocara", async () => {
    await withSale(async (q, d) => {
      const { id } = await requestIssue({ db: d, config: cfg(), provider: createArcaProvider() }, SALE, K(), "homologacion");
      await login(q, CEO);
      const other = fiscalDb(q);
      await assert.rejects(() => other.requestIssue(SALE, K(), "homologacion"), (e) => e instanceof FiscalDbError && e.code === "42501");
      assert.equal(await other.getDocument(id), null, "la política de lectura lo oculta");
      await assert.rejects(() => other.transition(id, "en_proceso"), (e) => e.code === "42501");
      await assert.rejects(() => other.logEvent(id, "error"), (e) => e.code === "42501");
    });
  });
});

describe("solicitud idempotente", () => {
  it("una venta, un comprobante: repetir (con la misma clave o con otra) devuelve el mismo y deja un solo evento de solicitud", async () => {
    await withSale(async (q, d) => {
      const deps = { db: d, config: cfg(), provider: createArcaProvider() };
      const key = K();
      const a = await requestIssue(deps, SALE, key, "homologacion");
      const b = await requestIssue(deps, SALE, key, "homologacion");
      const c = await requestIssue(deps, SALE, K(), "homologacion");
      assert.equal(a.created, true);
      assert.equal(b.created, false);
      assert.equal(c.created, false);
      assert.deepEqual([b.id, c.id], [a.id, a.id]);
      assert.equal((await events(q, a.id)).filter((e) => e.kind === "solicitud").length, 1);
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 1);
    });
  });

  it("pedir la emisión no toca la venta (separación total)", async () => {
    await withSale(async (q, d) => {
      const before = (await q("select count(*) n, sum(total) t from public.sales")).rows[0];
      await requestIssue({ db: d, config: cfg(), provider: createArcaProvider() }, SALE, K(), "homologacion");
      const after = (await q("select count(*) n, sum(total) t from public.sales")).rows[0];
      assert.deepEqual(after, before);
      assert.equal(Number((await q("select stock from public.product_variants where id = $1", [VAR])).rows[0].stock), 10);
    });
  });
});

describe("procesar sin integración real (lo que corre hoy)", () => {
  it("sin credenciales no se intenta nada: queda pendiente y se anotan solo los NOMBRES que faltan", async () => {
    await withSale(async (q, d) => {
      const provider = fake(AUTHORIZED);
      const deps = { db: d, config: cfg({ configured: false, missing: ["FISCAL_ARCA_CERT", "FISCAL_ARCA_KEY"] }), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      const r = await processDocument(deps, id);
      assert.deepEqual(r, { outcome: "not_configured", missing: ["FISCAL_ARCA_CERT", "FISCAL_ARCA_KEY"] });
      assert.equal(provider.calls, 0);
      assert.equal((await d.getDocument(id)).status, "pendiente");
      const ev = (await events(q, id)).at(-1);
      assert.equal(ev.kind, "error");
      assert.deepEqual(ev.payload, { code: "not_configured", missing: ["FISCAL_ARCA_CERT", "FISCAL_ARCA_KEY"] });
    });
  });

  it("con credenciales pero con el adaptador de ARCA sin integrar: termina en «error» registrado y NUNCA emite", async () => {
    await withSale(async (q, d) => {
      const deps = { db: d, config: cfg(), provider: createArcaProvider() };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      const r = await processDocument(deps, id);
      assert.deepEqual(r, { outcome: "failed", status: "error" });
      const doc = (await q("select status, cae, number, last_error from public.fiscal_documents where id = $1", [id])).rows[0];
      assert.equal(doc.status, "error");
      assert.equal(doc.cae, null);
      assert.equal(doc.number, null);
      assert.match(doc.last_error, /no implementada/i);
      const kinds = (await events(q, id)).map((e) => e.kind);
      assert.deepEqual(kinds, ["solicitud", "cambio_estado", "solicitud_arca", "error", "cambio_estado"]);
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents where status = 'emitido'")).rows[0].n), 0);
    });
  });

  it("repetir sin pedir reintento no vuelve a llamar; con reintento vuelve a pasar por pendiente y a quedar en error", async () => {
    await withSale(async (q, d) => {
      const provider = fake(() => { throw new Error("falla"); });
      const deps = { db: d, config: cfg(), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      await processDocument(deps, id);
      assert.equal(provider.calls, 1);
      assert.deepEqual(await processDocument(deps, id), { outcome: "replay", status: "error" });
      assert.equal(provider.calls, 1);
      assert.deepEqual(await processDocument(deps, id, { retry: true }), { outcome: "failed", status: "error" });
      assert.equal(provider.calls, 2);
    });
  });
});

describe("estados y trazabilidad (con proveedor falso, solo en pruebas)", () => {
  it("autorizado: pasa a «emitido» con los datos completos, deja la respuesta sin credenciales y no se vuelve a procesar", async () => {
    await withSale(async (q, d) => {
      const provider = fake(AUTHORIZED);
      const deps = { db: d, config: cfg(), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      assert.deepEqual(await processDocument(deps, id), { outcome: "issued", status: "emitido" });
      const doc = (await q("select status, cae, number, doc_type, point_of_sale from public.fiscal_documents where id = $1", [id])).rows[0];
      assert.deepEqual([doc.status, doc.cae, Number(doc.number), doc.doc_type, doc.point_of_sale], ["emitido", "70123456789012", 7, 11, 1]);
      const response = (await events(q, id)).find((e) => e.kind === "respuesta_arca");
      assert.equal(response.payload.resultado, "autorizado");
      assert.doesNotMatch(JSON.stringify(await events(q, id)), /NO-DEBE-GUARDARSE/, "el token de la respuesta se descartó");
      assert.deepEqual(await processDocument(deps, id), { outcome: "replay", status: "emitido" });
      assert.equal(provider.calls, 1, "no se emite dos veces");
    });
  });

  it("rechazado: guarda el motivo y queda cerrado", async () => {
    await withSale(async (q, d) => {
      const provider = fake(() => ({ kind: "rejected", reason: "Documento del receptor inválido" }));
      const deps = { db: d, config: cfg(), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      assert.deepEqual(await processDocument(deps, id), { outcome: "rejected", status: "rechazado" });
      assert.match((await d.getDocument(id)).lastError, /inválido/);
      assert.deepEqual(await processDocument(deps, id, { retry: true }), { outcome: "replay", status: "rechazado" });
      assert.equal(provider.calls, 1);
    });
  });

  it("un error del proveedor guarda un motivo genérico: el mensaje interno (con datos sensibles) no se persiste", async () => {
    await withSale(async (q, d) => {
      const provider = fake(() => { throw new Error("fallo con CLAVE-PRIVADA-123 y token abc"); });
      const deps = { db: d, config: cfg(), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      await processDocument(deps, id);
      const stored = JSON.stringify([(await d.getDocument(id)), await events(q, id)]);
      assert.doesNotMatch(stored, /CLAVE-PRIVADA|abc/);
      assert.match((await d.getDocument(id)).lastError, /Error al comunicarse/);
    });
  });

  it("un segundo proceso con una lectura vieja (todavía «pendiente») no vuelve a llamar al proveedor: la base rechaza la transición", async () => {
    await withSale(async (q, d) => {
      // La carrera real entre conexiones la resuelve el bloqueo de fila (for update) de fiscal_transition; PGlite tiene una sola
      // conexión y NO hay todavía una prueba con conexiones reales. Acá se reproduce su efecto: el segundo proceso leyó el
      // estado antes de que el primero lo cambiara.
      const provider = fake(AUTHORIZED);
      const deps = { db: d, config: cfg(), provider };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      const stale = { ...d, getDocument: async (x) => (stale.reads++ === 0 ? { id: x, saleId: SALE, environment: "homologacion", status: "pendiente", lastError: null } : d.getDocument(x)), reads: 0 };
      assert.equal((await processDocument(deps, id)).outcome, "issued");
      const second = await processDocument({ ...deps, db: stale }, id);
      assert.deepEqual(second, { outcome: "conflict", status: "emitido" });
      assert.equal(provider.calls, 1);
    });
  });

  it("los eventos son de solo agregado y la secuencia cuenta la historia completa", async () => {
    await withSale(async (q, d) => {
      const deps = { db: d, config: cfg(), provider: fake(AUTHORIZED) };
      const { id } = await requestIssue(deps, SALE, K(), "homologacion");
      await processDocument(deps, id);
      const ev = await events(q, id);
      assert.deepEqual(ev.map((e) => e.kind), ["solicitud", "cambio_estado", "solicitud_arca", "respuesta_arca", "cambio_estado"]);
      assert.deepEqual(ev.filter((e) => e.kind === "cambio_estado").map((e) => [e.from_status, e.to_status]), [["pendiente", "en_proceso"], ["en_proceso", "emitido"]]);
      await q("reset role");
      await assert.rejects(() => q("update public.fiscal_events set note = 'x'"));
      await assert.rejects(() => q("delete from public.fiscal_events"));
    });
  });
});

describe("producción: dos llaves independientes, ambas apagadas", () => {
  it("con la llave del servidor apagada se rechaza antes de llegar a la base", async () => {
    await withSale(async (q, d) => {
      const deps = { db: d, config: cfg({ productionAllowed: false }), provider: fake(AUTHORIZED) };
      await assert.rejects(() => requestIssue(deps, SALE, K(), "produccion"), (e) => e.code === "55000");
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 0);
    });
  });

  it("con la llave del servidor encendida pero la de la base apagada, la base lo rechaza", async () => {
    await withSale(async (q, d) => {
      const deps = { db: d, config: cfg({ productionAllowed: true }), provider: fake(AUTHORIZED) };
      await assert.rejects(() => requestIssue(deps, SALE, K(), "produccion"), (e) => e.code === "55000");
      assert.equal((await d.getSettings()).productionEnabled, false, "production_enabled sigue en false");
    });
  });

  it("un comprobante de producción ya registrado no se procesa si el servidor no lo permite", async () => {
    await withSale(async (q, d) => {
      await q("reset role");
      await q("update public.fiscal_settings set production_enabled = true");
      await login(q, DEV);
      const provider = fake(AUTHORIZED);
      const on = { db: d, config: cfg({ productionAllowed: true }), provider };
      const { id } = await requestIssue(on, SALE, K(), "produccion");
      const off = { db: d, config: cfg({ productionAllowed: false }), provider };
      assert.deepEqual(await processDocument(off, id), { outcome: "production_disabled" });
      assert.equal(provider.calls, 0);
      assert.equal((await d.getDocument(id)).status, "pendiente");
    });
  });

  it("producción_enabled arranca en false en la base", async () => {
    await asAdmin(db, async (q) => {
      assert.equal((await q("select production_enabled p from public.fiscal_settings")).rows[0].p, false);
    });
  });
});
