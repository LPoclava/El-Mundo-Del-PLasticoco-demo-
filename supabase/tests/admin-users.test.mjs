// Pruebas de admin_list_users() contra PostgreSQL real (PGlite) con las migraciones del repositorio.
// Ejecutar: cd supabase/tests && npm install && npm test
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ID, newDb, applyMigrations, seedAuthUsersAndStaff, asAnon, asUser, asAdmin,
} from "./helpers.mjs";

let db;

before(async () => {
  db = await newDb();
  await applyMigrations(db, (f) => f < "20261029"); // lo que ya había antes de los roles
  await seedAuthUsersAndStaff(db);
  await applyMigrations(db, (f) => f >= "20261029"); // roles y todo lo posterior, incluida admin_list_users
  await db.exec(`
    update auth.users set last_sign_in_at = '2026-11-01T10:00:00Z' where id = '${ID.ceo}';
    insert into public.profiles (user_id, display_name, role, active) values
      ('${ID.ceo2}', 'CEO dos', 'ceo', true),
      ('${ID.gerente}', 'Gerente', 'gerente', true),
      ('${ID.empleado}', 'Empleado', 'empleado', true),
      ('${ID.inactivo}', 'Inactivo', 'empleado', false);
  `);
});

describe("admin_list_users: quién puede usarla", () => {
  it("el CEO activo ve a todos, con correo, rol, estado y fechas", async () => {
    await asUser(db, ID.ceo, async (q) => {
      const rows = (await q("select * from public.admin_list_users()")).rows;
      assert.equal(rows.length, 7); // 7 cuentas de Auth sembradas
      const g = rows.find((r) => r.user_id === ID.gerente);
      assert.equal(g.email, "gerente@example.test");
      assert.equal(g.display_name, "Gerente");
      assert.equal(g.role, "gerente");
      assert.equal(g.active, true);
      assert.equal(g.has_profile, true);
      assert.ok(g.created_at);
      const corporativa = rows.find((r) => r.user_id === ID.ceo);
      assert.ok(corporativa.last_sign_in_at);
      assert.equal(rows.find((r) => r.user_id === ID.inactivo).active, false);
    });
  });

  it("incluye las cuentas de Auth sin perfil, marcadas y al final", async () => {
    await asUser(db, ID.ceo, async (q) => {
      const rows = (await q("select * from public.admin_list_users()")).rows;
      const sin = rows.filter((r) => !r.has_profile);
      assert.deepEqual(sin.map((r) => r.user_id).sort(), [ID.sinPerfil, ID.enStaffSinPerfil].sort());
      for (const r of sin) {
        assert.equal(r.role, null);
        assert.equal(r.active, null);
        assert.equal(r.display_name, null);
      }
      const firstWithoutProfile = rows.findIndex((r) => !r.has_profile);
      assert.ok(rows.slice(firstWithoutProfile).every((r) => !r.has_profile), "las cuentas sin perfil van al final");
      assert.equal(rows[0].role, "ceo", "el orden empieza por los CEO");
    });
  });

  it("solo devuelve las columnas previstas (nada de metadatos ni credenciales)", async () => {
    await asUser(db, ID.ceo, async (q) => {
      const r = await q("select * from public.admin_list_users() limit 1");
      assert.deepEqual(
        r.fields.map((f) => f.name),
        ["user_id", "email", "display_name", "role", "active", "has_profile", "created_at", "last_sign_in_at"],
      );
    });
  });

  for (const [nombre, uid] of [["gerente", ID.gerente], ["empleado", ID.empleado]]) {
    it(`el ${nombre} no puede usarla`, async () => {
      await asUser(db, uid, async (q) => {
        await q.fails("select * from public.admin_list_users()", [], "42501");
      });
    });
  }

  it("un perfil inactivo, aunque sea de CEO, no puede usarla", async () => {
    // Se desactiva como lo haría el SQL Editor y se prueba en la misma transacción, que se revierte.
    await db.exec("begin");
    try {
      await db.exec(`update public.profiles set active = false where user_id = '${ID.ceo2}'`);
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ID.ceo2 })]);
      await assert.rejects(db.query("select * from public.admin_list_users()"), (e) => e.code === "42501");
    } finally {
      await db.exec("rollback");
    }
  });

  it("una cuenta sin perfil no puede usarla", async () => {
    await asUser(db, ID.sinPerfil, async (q) => {
      await q.fails("select * from public.admin_list_users()", [], "42501");
    });
  });

  it("sin sesión (anon) no tiene permiso de ejecución", async () => {
    await asAnon(db, async (q) => {
      await q.fails("select * from public.admin_list_users()", [], "42501");
    });
  });
});

describe("admin_list_users junto con las funciones admin_*", () => {
  it("tras asignar un perfil a una cuenta sin perfil, el listado la muestra con su rol", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_create_profile($1, 'Persona nueva', 'empleado')", [ID.sinPerfil]);
      const r = (await q("select * from public.admin_list_users() where user_id = $1", [ID.sinPerfil])).rows[0];
      assert.equal(r.has_profile, true);
      assert.equal(r.role, "empleado");
      assert.equal(r.display_name, "Persona nueva");
    });
  });

  it("un cambio de rol y de estado hecho por el CEO se ve en el listado", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q("select public.admin_set_role($1, 'gerente')", [ID.empleado]);
      await q("select public.admin_set_active($1, false)", [ID.gerente]);
      const rows = (await q("select * from public.admin_list_users()")).rows;
      assert.equal(rows.find((r) => r.user_id === ID.empleado).role, "gerente");
      assert.equal(rows.find((r) => r.user_id === ID.gerente).active, false);
    });
  });

  it("el CEO no puede cambiar su propio rol ni estado (regla que la pantalla debe respetar)", async () => {
    await asUser(db, ID.ceo, async (q) => {
      await q.fails("select public.admin_set_role($1, 'empleado')", [ID.ceo], "42501");
      await q.fails("select public.admin_set_active($1, false)", [ID.ceo], "42501");
    });
  });
});

describe("admin_list_users: auditoría de seguridad de la función", () => {
  const DEF = "select p.oid, p.prosecdef, p.provolatile, p.proconfig, p.proacl, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_list_users'";

  it("corre con permisos del dueño y con search_path vacío (sin resolución de nombres manipulable)", async () => {
    await asAdmin(db, async (q) => {
      const f = (await q(DEF)).rows[0];
      assert.equal(f.prosecdef, true);
      assert.ok((f.proconfig ?? []).some((c) => /^search_path=("")?$/.test(c)), `proconfig: ${JSON.stringify(f.proconfig)}`);
    });
  });

  it("es de solo lectura (stable) y su código no escribe nada", async () => {
    await asAdmin(db, async (q) => {
      const f = (await q(DEF)).rows[0];
      assert.equal(f.provolatile, "s");
      assert.doesNotMatch(f.def, /\b(insert|update|delete|truncate|alter|drop|grant|set_config)\b/i);
    });
  });

  it("la verificación de rol está dentro de la función y es la primera instrucción", async () => {
    await asAdmin(db, async (q) => {
      const { def } = (await q(DEF)).rows[0];
      const check = def.indexOf("has_role_at_least('ceo')");
      const read = def.indexOf("auth.users");
      assert.ok(check > 0 && read > 0 && check < read, "el control de CEO debe ir antes de leer auth.users");
      assert.match(def, /errcode\s*=\s*'42501'|ERRCODE = '42501'/i);
    });
  });

  it("permisos de ejecución: nadie por defecto (PUBLIC), anon no, authenticated sí", async () => {
    await asAdmin(db, async (q) => {
      const r = (await q(`select
        has_function_privilege('anon', 'public.admin_list_users()', 'execute') as anon,
        has_function_privilege('authenticated', 'public.admin_list_users()', 'execute') as authenticated`)).rows[0];
      assert.equal(r.anon, false);
      assert.equal(r.authenticated, true);
      const acl = (await q(`select a.grantee from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.proname = 'admin_list_users' and p.pronamespace = 'public'::regnamespace`)).rows.map((x) => Number(x.grantee));
      assert.ok(!acl.includes(0), "PUBLIC (grantee 0) no debe tener EXECUTE");
    });
  });

  it("no toca columnas sensibles de auth.users", async () => {
    await asAdmin(db, async (q) => {
      const { def } = (await q(DEF)).rows[0];
      for (const col of ["encrypted_password", "raw_user_meta_data", "raw_app_meta_data", "confirmation_token", "recovery_token", "phone", "invited_at", "banned_until"]) {
        assert.ok(!def.includes(col), `la función menciona ${col}`);
      }
      for (const col of ["u.id", "u.email", "u.created_at", "u.last_sign_in_at"]) assert.ok(def.includes(col), `debería leer ${col}`);
    });
  });

  it("un rol falso en el token (claims, user_metadata o app_metadata) no sirve: manda la tabla profiles", async () => {
    const forged = [
      { user_metadata: { role: "ceo" } },
      { app_metadata: { role: "ceo", roles: ["ceo"] } },
      { role: "authenticated", user_role: "ceo", app_role: "ceo" },
    ];
    for (const claims of forged) {
      await asUser(db, ID.empleado, async (q) => {
        await q.fails("select * from public.admin_list_users()", [], "42501");
      }, claims);
    }
  });

  it("no hay escalada: ni listar ni haber sido CEO antes cambia los perfiles", async () => {
    await asUser(db, ID.ceo, async (q) => {
      const antes = (await q("select user_id, role, active from public.profiles order by user_id")).rows;
      await q("select * from public.admin_list_users()");
      const despues = (await q("select user_id, role, active from public.profiles order by user_id")).rows;
      assert.deepEqual(despues, antes);
    });
  });

  it("el empleado sigue sin poder usar las funciones admin_* aunque llame directamente", async () => {
    await asUser(db, ID.empleado, async (q) => {
      await q.fails("select public.admin_set_role($1, 'ceo')", [ID.empleado], "42501");
      await q.fails("select public.admin_create_profile($1, 'X', 'ceo')", [ID.sinPerfil], "42501");
    });
  });
});
