// Etapa 1, fase 1: método QR, reportes por método de pago, acceso de desarrollo y estructura fiscal (PGlite).
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ID, CAT1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asAnon, asAdmin } from "./helpers.mjs";

let db;
const K = () => crypto.randomUUID();
const PROD = "50000000-0000-4000-8000-0000000000a1";
const VAR = "60000000-0000-4000-8000-0000000000a1";
const DEV = ID.gerente; // desarrollo con rol «gerente»: el acceso no depende del rol del comercio
const NO_DEV = ID.ceo2; // CEO del comercio sin acceso de desarrollo
const SALE = "70000000-0000-4000-8000-0000000000a1";

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
      ('${ID.empleado}', 'Empleada Uno', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', false);
    insert into public.developer_access (user_id, note) values ('${ID.gerente}', 'prueba'), ('${ID.inactivo}', 'prueba inactivo');
  `);
});

async function login(q, uid) {
  await q("reset role");
  await q("set local role authenticated");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: uid })]);
}
const withData = (fn) =>
  asAdmin(db, async (q) => {
    await q(`insert into public.products (id, name, category_id, barcode, publish_enabled) values ('${PROD}', 'Balde QR', '${CAT1}', '7792222000011', false)`);
    await q(`insert into public.product_variants (id, product_id, price, position, stock) values ('${VAR}', '${PROD}', 1000, 0, 50)`);
    await q(`insert into public.sales (id, created_at, user_id, user_name, payment_method, total, idempotency_key) values ('${SALE}', now(), '${ID.empleado}', 'Empleada Uno', 'efectivo', 1000, '${K()}')`);
    return fn(q);
  });

describe("método de pago QR", () => {
  it("existe, está habilitado y una venta con QR se confirma como cualquier otra", async () => {
    await withData(async (q) => {
      const m = (await q("select enabled, position from public.payment_methods where code = 'qr'")).rows[0];
      assert.equal(m.enabled, true);
      await login(q, ID.empleado);
      const r = (await q("select public.confirm_sale($1::uuid, 'qr', $2::jsonb) as r", [K(), JSON.stringify([{ variant_id: VAR, quantity: 2 }])])).rows[0].r;
      assert.equal(r.payment_method, "qr");
      assert.equal(r.payment_label, "QR");
      assert.equal(r.total, 2000);
    });
  });
});

describe("ventas por método de pago", () => {
  it("agrupa operaciones y facturación por método y rechaza a anónimos, inactivos y períodos inválidos", async () => {
    await withData(async (q) => {
      await login(q, ID.empleado);
      await q("select public.confirm_sale($1::uuid, 'qr', $2::jsonb)", [K(), JSON.stringify([{ variant_id: VAR, quantity: 1 }])]);
      const from = "2000-01-01T00:00:00Z";
      const to = "2100-01-01T00:00:00Z";
      // El empleado solo ve las suyas: la de prueba (efectivo) y la de QR.
      const r = (await q("select public.sales_by_payment_method($1, $2) as r", [from, to])).rows[0].r;
      assert.equal(r.operations_total, 2);
      assert.equal(r.revenue_total, 2000);
      const by = Object.fromEntries(r.methods.map((x) => [x.code, x]));
      assert.equal(by.efectivo.operations, 1);
      assert.equal(by.qr.operations, 1);
      assert.equal(by.qr.revenue, 1000);
      assert.equal(by.otro, undefined, "los métodos deshabilitados sin ventas no aparecen");
      await q.fails("select public.sales_by_payment_method($1, $2)", [to, from], "22023");
      await q.fails("select public.sales_by_payment_method(null, $1)", [to], "22023");
      await login(q, ID.inactivo);
      await q.fails("select public.sales_by_payment_method($1, $2)", [from, to], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.sales_by_payment_method(now() - interval '1 day', now())", [], "42501");
    });
  });

  it("el gerente ve las ventas de todos; el empleado solo las propias", async () => {
    await withData(async (q) => {
      await q(`insert into public.sales (user_id, user_name, payment_method, total, idempotency_key) values ('${ID.gerente}', 'G', 'qr', 50, '${K()}')`);
      await login(q, ID.empleado);
      assert.equal((await q("select public.sales_by_payment_method('2000-01-01', '2100-01-01') as r")).rows[0].r.operations_total, 1);
      await login(q, ID.gerente);
      const g = (await q("select public.sales_by_payment_method('2000-01-01', '2100-01-01') as r")).rows[0].r;
      assert.equal(g.operations_total, 2);
      await login(q, ID.sinPerfil);
      await q.fails("select public.sales_by_payment_method('2000-01-01', '2100-01-01')", [], "42501");
    });
  });

  it("el mes se cuenta en hora de Río Turbio, no en UTC", async () => {
    await asAdmin(db, async (q) => {
      // 01:00 UTC del 1/12 todavía es 30/11 en Argentina (UTC-3).
      await q(`insert into public.sales (created_at, user_id, user_name, payment_method, total, idempotency_key)
               values (date_trunc('month', now() at time zone 'America/Argentina/Rio_Gallegos') at time zone 'America/Argentina/Rio_Gallegos' - interval '2 hours',
                       '${ID.empleado}', 'E', 'qr', 700, '${K()}'),
                      (date_trunc('month', now() at time zone 'America/Argentina/Rio_Gallegos') at time zone 'America/Argentina/Rio_Gallegos' + interval '2 hours',
                       '${ID.empleado}', 'E', 'qr', 300, '${K()}')`);
      await login(q, ID.empleado);
      const rows = (await q("select public.sales_monthly_by_payment_method(3) as r")).rows[0].r;
      const months = [...new Set(rows.map((x) => x.month))];
      assert.equal(months.length, 2, "una venta cae en el mes anterior y otra en el actual");
      const [prev, cur] = rows.sort((a, b) => a.month.localeCompare(b.month));
      assert.equal(prev.revenue, 700);
      assert.equal(cur.revenue, 300);
      await q.fails("select public.sales_monthly_by_payment_method(0)", [], "22023");
      await q.fails("select public.sales_monthly_by_payment_method(25)", [], "22023");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.sales_monthly_by_payment_method(3)", [], "42501");
    });
  });
});

describe("acceso del grupo de desarrollo", () => {
  it("la tabla no se toca por la API y is_developer respeta perfil activo y alta", async () => {
    await asAdmin(db, async (q) => {
      await login(q, DEV);
      await q.fails("select * from public.developer_access", [], "42501");
      await q.fails("insert into public.developer_access (user_id) values ($1)", [ID.empleado], "42501");
      assert.equal((await q("select public.is_developer() as r")).rows[0].r, true);
      await q.fails("select public.require_developer()", [], "42501");
      await login(q, NO_DEV);
      assert.equal((await q("select public.is_developer() as r")).rows[0].r, false, "ser CEO del comercio no alcanza");
      await login(q, ID.inactivo);
      assert.equal((await q("select public.is_developer() as r")).rows[0].r, false, "perfil inactivo pierde el acceso");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.is_developer()", [], "42501");
      await q.fails("select * from public.developer_access", [], "42501");
    });
  });
});

describe("estructura fiscal", () => {
  it("el CEO del comercio no ve ni opera el circuito; el de desarrollo sí", async () => {
    await withData(async (q) => {
      await login(q, DEV);
      await q("select public.fiscal_request_issue($1, $2)", [SALE, K()]);
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 1);
      await login(q, NO_DEV);
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 0);
      assert.equal(Number((await q("select count(*) n from public.fiscal_events")).rows[0].n), 0);
      assert.equal(Number((await q("select count(*) n from public.fiscal_settings")).rows[0].n), 0);
      await q.fails("select public.fiscal_request_issue($1, $2)", [SALE, K()], "42501");
      await q.fails("insert into public.fiscal_documents (sale_id, idempotency_key, requested_by) values ($1, $2, $3)", [SALE, K(), NO_DEV], "42501");
      await login(q, ID.empleado);
      await q.fails("select public.fiscal_request_issue($1, $2)", [SALE, K()], "42501");
    });
    await asAnon(db, async (q) => {
      await q.fails("select public.fiscal_request_issue(gen_random_uuid(), gen_random_uuid())", [], "42501");
      await q.fails("select * from public.fiscal_documents", [], "42501");
    });
  });

  it("registrar una venta no crea ningún comprobante fiscal", async () => {
    await withData(async (q) => {
      await login(q, ID.empleado);
      await q("select public.confirm_sale($1::uuid, 'efectivo', $2::jsonb)", [K(), JSON.stringify([{ variant_id: VAR, quantity: 1 }])]);
      await q("reset role");
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 0);
    });
  });

  it("la solicitud es idempotente: una venta, un comprobante", async () => {
    await withData(async (q) => {
      await login(q, DEV);
      const key = K();
      const a = (await q("select public.fiscal_request_issue($1, $2) as r", [SALE, key])).rows[0].r;
      const b = (await q("select public.fiscal_request_issue($1, $2) as r", [SALE, K()])).rows[0].r;
      assert.equal(a.created, true);
      assert.equal(b.created, false);
      assert.equal(a.id, b.id);
      assert.equal(a.status, "pendiente");
      assert.equal(Number((await q("select count(*) n from public.fiscal_documents")).rows[0].n), 1);
      await q.fails("select public.fiscal_request_issue(gen_random_uuid(), $1)", [K()], "22023");
      await q.fails("select public.fiscal_request_issue($1, $2, 'otro')", [SALE, K()], "22023");
    });
  });

  it("producción está apagada por defecto y no se puede solicitar ni avanzar en ese entorno", async () => {
    await withData(async (q) => {
      await login(q, DEV);
      assert.equal((await q("select production_enabled p from public.fiscal_settings")).rows[0].p, false);
      await q.fails("select public.fiscal_request_issue($1, $2, 'produccion')", [SALE, K()], "55000");
      // Con la llave encendida (como propietario) se puede solicitar; si se apaga de nuevo, no avanza.
      await q("reset role");
      await q("update public.fiscal_settings set production_enabled = true");
      await login(q, DEV);
      const r = (await q("select public.fiscal_request_issue($1, $2, 'produccion') as r", [SALE, K()])).rows[0].r;
      await q("reset role");
      await q("update public.fiscal_settings set production_enabled = false");
      await login(q, DEV);
      await q.fails("select public.fiscal_transition($1, 'en_proceso')", [r.id], "55000");
    });
  });

  it("transiciones permitidas, datos obligatorios del emitido y registro de eventos de solo agregado", async () => {
    await withData(async (q) => {
      await login(q, DEV);
      const id = (await q("select public.fiscal_request_issue($1, $2) as r", [SALE, K()])).rows[0].r.id;
      await q.fails("select public.fiscal_transition($1, 'emitido')", [id], "55000");
      await q("select public.fiscal_transition($1, 'en_proceso')", [id]);
      await q.fails("select public.fiscal_transition($1, 'emitido')", [id], "22023");
      await q.fails("select public.fiscal_transition($1, 'rechazado')", [id], "22023");
      await q.fails("select public.fiscal_transition($1, 'pendiente')", [id], "55000");
      await q("select public.fiscal_transition($1, 'error', 'Sin conexión con ARCA')", [id]);
      assert.equal((await q("select last_error e from public.fiscal_documents where id = $1", [id])).rows[0].e, "Sin conexión con ARCA");
      await q("select public.fiscal_transition($1, 'pendiente')", [id]); // reintento
      await q("select public.fiscal_transition($1, 'en_proceso')", [id]);
      const ok = { cae: "12345678901234", doc_type: 11, point_of_sale: 1, number: 7, cae_expires_on: "2030-01-31" };
      await q("select public.fiscal_transition($1, 'emitido', null, $2::jsonb)", [id, JSON.stringify(ok)]);
      const d = (await q("select status, cae, number from public.fiscal_documents where id = $1", [id])).rows[0];
      assert.deepEqual([d.status, d.cae, Number(d.number)], ["emitido", "12345678901234", 7]);
      await q.fails("select public.fiscal_transition($1, 'en_proceso')", [id], "55000");
      const kinds = (await q("select kind from public.fiscal_events where document_id = $1 order by id", [id])).rows.map((x) => x.kind);
      assert.equal(kinds[0], "solicitud");
      assert.ok(kinds.filter((k) => k === "cambio_estado").length >= 5);
      await q.fails("update public.fiscal_events set note = 'x'", [], "42501"); // sin permiso de escritura por la API
      await q("reset role");
      await q.fails("update public.fiscal_events set note = 'x'", []);
      await q.fails("delete from public.fiscal_events", []);
      await q.fails("truncate public.fiscal_events", []);
    });
  });

  it("el CAE inválido y el emitido incompleto no entran; el registro rechaza credenciales", async () => {
    await withData(async (q) => {
      await login(q, DEV);
      const id = (await q("select public.fiscal_request_issue($1, $2) as r", [SALE, K()])).rows[0].r.id;
      await q("select public.fiscal_transition($1, 'en_proceso')", [id]);
      const bad = { cae: "123", doc_type: 11, point_of_sale: 1, number: 7, cae_expires_on: "2030-01-31" };
      await q.fails("select public.fiscal_transition($1, 'emitido', null, $2::jsonb)", [id, JSON.stringify(bad)], "22023");
      await q("select public.fiscal_log_event($1, 'respuesta_arca', $2::jsonb, 'ok')", [id, JSON.stringify({ resultado: "A", observaciones: [] })]);
      await q.fails("select public.fiscal_log_event($1, 'respuesta_arca', $2::jsonb)", [id, JSON.stringify({ Token: "abc" })], "22023");
      await q.fails("select public.fiscal_log_event($1, 'respuesta_arca', $2::jsonb)", [id, JSON.stringify({ a: { private_key: "x" } })], "22023");
      await q.fails("select public.fiscal_log_event($1, 'solicitud', null)", [id], "22023");
      await login(q, NO_DEV);
      await q.fails("select public.fiscal_log_event($1, 'error', null)", [id], "42501");
    });
  });
});
