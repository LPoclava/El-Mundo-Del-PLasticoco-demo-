// Pruebas de la autenticación del panel, los roles y el menú. Ejecutar: node --test scripts/panel-auth.test.mjs
// Cubren la lógica pura (sin red ni React) y vigilan que no vuelva ningún resto de la demostración.
// NO prueban Supabase Auth ni las políticas de la base: eso se prueba en supabase/tests (PGlite) y, contra el
// Supabase real, solo en una prueba manual con cuentas de cada rol.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ROLES, SECTIONS, atLeast, canAccessPath, menuGroups, sectionOf, sectionsFor,
} from "../src/lib/panel/roles.ts";
import { REFRESH_MIN_GAP_MS, isRole, loginFailureMessage, profileFromRow, shouldRefresh, validateLogin } from "../src/lib/panel/session.ts";
import { canManage, parseUserRow, userActionMessage, validateDisplayName } from "../src/lib/users/rules.ts";

const ids = (role) => sectionsFor(role).map((s) => s.id);

describe("menú por rol", () => {
  it("el empleado ve solo el dashboard y el escáner con ventas", () => {
    assert.deepEqual(ids("empleado"), ["inicio", "precios"]);
  });

  it("el gerente suma stock, productos, categorías y banners; no usuarios", () => {
    assert.deepEqual(ids("gerente"), ["inicio", "precios", "stock", "productos", "categorias", "banners"]);
  });

  it("el CEO ve todo, incluida la administración de usuarios", () => {
    assert.deepEqual(ids("ceo"), ["inicio", "precios", "stock", "productos", "categorias", "banners", "usuarios"]);
  });

  it("cada rol incluye lo del anterior", () => {
    const empleado = new Set(ids("empleado"));
    const gerente = new Set(ids("gerente"));
    const ceo = new Set(ids("ceo"));
    for (const id of empleado) assert.ok(gerente.has(id), `${id} falta en gerente`);
    for (const id of gerente) assert.ok(ceo.has(id), `${id} falta en CEO`);
  });

  it("los grupos del menú no quedan vacíos y no repiten secciones", () => {
    for (const role of ROLES) {
      const groups = menuGroups(role);
      assert.ok(groups.every((g) => g.items.length > 0));
      const all = groups.flatMap((g) => g.items.map((s) => s.id));
      assert.equal(new Set(all).size, all.length);
      assert.deepEqual(all.sort(), ids(role).sort());
    }
  });

  it("CRM y Configuración ya no existen en ningún menú", () => {
    for (const role of ROLES) {
      assert.ok(!ids(role).includes("crm"));
      assert.ok(!ids(role).includes("configuracion"));
    }
    assert.equal(SECTIONS.some((s) => /crm|configuracion/.test(s.href)), false);
  });
});

describe("acceso por dirección", () => {
  const cases = [
    ["empleado", "/panel", true],
    ["empleado", "/panel/precios", true],
    ["empleado", "/panel/stock", false],
    ["empleado", "/panel/productos", false],
    ["empleado", "/panel/productos/nuevo", false],
    ["empleado", "/panel/banners/abc", false],
    ["empleado", "/panel/usuarios", false],
    ["gerente", "/panel/stock", true],
    ["gerente", "/panel/productos/nuevo", true],
    ["gerente", "/panel/categorias/abc", true],
    ["gerente", "/panel/banners", true],
    ["gerente", "/panel/usuarios", false],
    ["ceo", "/panel/usuarios", true],
    ["ceo", "/panel/stock", true],
  ];
  for (const [role, path, expected] of cases) {
    it(`${role} ${expected ? "puede" : "no puede"} ir a ${path}`, () => {
      assert.equal(canAccessPath(role, path), expected);
    });
  }

  it("una dirección que no es de ninguna sección no se concede a nadie", () => {
    for (const role of ROLES) {
      for (const path of ["/panel/crm", "/panel/configuracion", "/panel/inexistente", "/panel/usuariosx", "/otra"]) {
        assert.equal(canAccessPath(role, path), false, `${role} ${path}`);
      }
    }
  });

  it("sectionOf elige la sección más específica", () => {
    assert.equal(sectionOf("/panel/productos/nuevo")?.id, "productos");
    assert.equal(sectionOf("/panel")?.id, "inicio");
  });

  it("la jerarquía es empleado < gerente < ceo", () => {
    assert.ok(atLeast("ceo", "gerente") && atLeast("gerente", "empleado") && atLeast("ceo", "ceo"));
    assert.ok(!atLeast("empleado", "gerente") && !atLeast("gerente", "ceo"));
  });
});

describe("el menú coincide con las pantallas", () => {
  const SHELL = join(import.meta.dirname, "..", "src", "app", "panel", "(shell)");

  function pages(dir = SHELL) {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return pages(full);
      return name === "page.tsx" ? [full] : [];
    });
  }

  const hrefOf = (file) => {
    const rel = relative(SHELL, join(file, ".."));
    return rel ? `/panel/${rel.replaceAll("\\", "/")}` : "/panel";
  };

  it("toda sección del menú tiene su pantalla", () => {
    for (const s of SECTIONS) {
      const dir = s.href === "/panel" ? SHELL : join(SHELL, s.href.replace("/panel/", ""));
      assert.ok(existsSync(join(dir, "page.tsx")), `falta la pantalla de ${s.href}`);
    }
  });

  it("toda pantalla del panel pertenece a una sección del menú", () => {
    for (const file of pages()) {
      const href = hrefOf(file).replace(/\[[^\]]+\]/g, "x");
      assert.ok(sectionOf(href), `la pantalla ${href} no pertenece a ninguna sección`);
    }
  });

  it("el rol mínimo de cada pantalla coincide con el de su sección", () => {
    for (const file of pages()) {
      const href = hrefOf(file).replace(/\[[^\]]+\]/g, "x");
      const section = sectionOf(href);
      const guard = readFileSync(file, "utf8").match(/<RoleGuard min="(\w+)"/);
      if (guard) {
        assert.equal(guard[1], section.minRole, `${hrefOf(file)}: RoleGuard ${guard[1]} y menú ${section.minRole}`);
      } else {
        // Sin RoleGuard solo pueden estar las secciones de empleado, que se protegen con la sesión del punto de venta.
        assert.equal(section.minRole, "empleado", `${hrefOf(file)} no tiene RoleGuard y su sección pide ${section.minRole}`);
      }
    }
  });

  it("no existen las pantallas retiradas", () => {
    for (const gone of ["crm", "configuracion", join("usuarios", "nuevo")]) {
      assert.equal(existsSync(join(SHELL, gone)), false, `todavía existe ${gone}`);
    }
  });
});

describe("perfil: el rol sale solo de una fila de profiles", () => {
  it("fila activa con rol válido", () => {
    assert.deepEqual(profileFromRow({ role: "gerente", active: true, display_name: " Ana " }), { role: "gerente", displayName: "Ana" });
  });

  it("sin nombre usa el de respaldo (el correo)", () => {
    assert.equal(profileFromRow({ role: "empleado", active: true, display_name: "  " }, "ana@example.test").displayName, "ana@example.test");
    assert.equal(profileFromRow({ role: "empleado", active: true, display_name: null }, "x@y.z").displayName, "x@y.z");
  });

  for (const [nombre, fila] of [
    ["sin fila", null],
    ["fila inexistente", undefined],
    ["inactiva", { role: "ceo", active: false, display_name: "Ex" }],
    ["activa como texto", { role: "ceo", active: "true", display_name: "X" }],
    ["rol desconocido", { role: "admin", active: true, display_name: "X" }],
    ["sin rol", { active: true, display_name: "X" }],
    ["rol con otra forma", { role: { name: "ceo" }, active: true }],
    ["no es un objeto", "ceo"],
  ]) {
    it(`se rechaza una fila ${nombre}`, () => {
      assert.equal(profileFromRow(fila), null);
    });
  }

  it("ignora un rol que venga del token o de user_metadata", () => {
    assert.equal(profileFromRow({ user_metadata: { role: "ceo" }, app_metadata: { role: "ceo" }, active: true }), null);
  });

  it("la lista de roles de session.ts coincide con ROLES", () => {
    for (const r of ROLES) assert.ok(isRole(r));
    assert.ok(!isRole("admin") && !isRole("") && !isRole(undefined) && !isRole(1));
  });
});

describe("formulario de ingreso", () => {
  it("pide correo y contraseña", () => {
    assert.deepEqual(validateLogin("", ""), { email: "Ingresá tu correo electrónico.", password: "Ingresá tu contraseña." });
  });

  it("rechaza un correo mal formado y acepta uno válido (con espacios alrededor)", () => {
    assert.ok(validateLogin("sin-arroba", "x").email);
    assert.deepEqual(validateLogin("  ana@example.test ", "secreta"), {});
  });

  it("no traba la contraseña con espacios ni la modifica", () => {
    assert.deepEqual(validateLogin("a@b.co", " con espacios "), {});
  });

  it("credenciales inválidas: mensaje genérico, sin distinguir correo de contraseña", () => {
    const m = loginFailureMessage({ message: "Invalid login credentials", status: 400 });
    assert.equal(m, "El correo o la contraseña no son correctos.");
    assert.equal(loginFailureMessage({ message: "User not found", status: 400 }), m);
  });

  it("distingue falta de conexión, demasiados intentos y caída del servidor", () => {
    assert.match(loginFailureMessage({ message: "Failed to fetch" }), /conexión/);
    assert.match(loginFailureMessage({ message: "x", status: 429 }), /demasiados intentos/i);
    assert.match(loginFailureMessage({ message: "x", status: 503 }), /servidor/);
  });
});

describe("usuarios: reglas de la pantalla", () => {
  const ME = "00000000-0000-4000-8000-000000000001";
  const row = (over = {}) => ({
    user_id: "00000000-0000-4000-8000-000000000002", email: "ana@example.test", display_name: "Ana", role: "gerente",
    active: true, has_profile: true, created_at: "2026-11-01T10:00:00Z", last_sign_in_at: null, ...over,
  });

  it("convierte una fila de admin_list_users()", () => {
    const u = parseUserRow(row());
    assert.equal(u.userId, "00000000-0000-4000-8000-000000000002");
    assert.equal(u.role, "gerente");
    assert.equal(u.active, true);
    assert.equal(u.hasProfile, true);
    assert.equal(u.lastSignInAt, null);
  });

  it("una cuenta sin perfil no inventa rol ni estado", () => {
    const u = parseUserRow(row({ has_profile: false, role: null, active: null, display_name: null }));
    assert.equal(u.hasProfile, false);
    assert.equal(u.role, null);
    assert.equal(u.active, null);
  });

  it("descarta filas mal formadas o con un rol que no existe", () => {
    assert.equal(parseUserRow(null), null);
    assert.equal(parseUserRow({}), null);
    assert.equal(parseUserRow(row({ role: "admin" })), null);
    assert.equal(parseUserRow(row({ created_at: undefined })), null);
  });

  it("nadie puede cambiarse a sí mismo el rol ni el estado", () => {
    const me = parseUserRow(row({ user_id: ME }));
    assert.deepEqual(canManage(ME, me), { changeRole: false, toggleActive: false, rename: true });
  });

  it("sobre otra persona con perfil se ofrecen todas las acciones", () => {
    assert.deepEqual(canManage(ME, parseUserRow(row())), { changeRole: true, toggleActive: true, rename: true });
  });

  it("sobre una cuenta sin perfil no se ofrece ninguna (solo darle acceso)", () => {
    const sin = parseUserRow(row({ has_profile: false, role: null, active: null }));
    assert.deepEqual(canManage(ME, sin), { changeRole: false, toggleActive: false, rename: false });
  });

  it("valida el nombre", () => {
    assert.ok(validateDisplayName("   "));
    assert.ok(validateDisplayName("x".repeat(81)));
    assert.equal(validateDisplayName("Ana"), null);
    assert.equal(validateDisplayName("x".repeat(80)), null);
  });

  it("traduce los rechazos conocidos de la base", () => {
    assert.match(userActionMessage({ code: "23514", message: "No se puede dejar la aplicación sin un CEO activo" }), /CEO activo/);
    assert.match(userActionMessage({ code: "42501", message: "No podés cambiar tu propio rol ni tu estado" }), /propio rol/);
    assert.match(userActionMessage({ code: "PGRST202", message: "Could not find the function public.admin_list_users" }), /20261108000001/);
    assert.match(userActionMessage({ code: "23505", message: "duplicate key value" }), /ya tiene un perfil/);
    assert.equal(userActionMessage({ code: "XX000", message: "otra cosa" }), null);
    assert.equal(userActionMessage(null), null);
  });
});

describe("no quedan restos de la demostración", () => {
  const SRC = join(import.meta.dirname, "..", "src");

  function files(dir) {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return files(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }
  const all = files(SRC).map((f) => ({ f: relative(SRC, f), text: readFileSync(f, "utf8") }));
  const offenders = (re) => all.filter(({ text }) => re.test(text)).map(({ f }) => f);

  it("ninguna contraseña ni correo de demostración", () => {
    assert.deepEqual(offenders(/demo-1234|DEMO_PASSWORD|DEMO_EMAIL_DOMAIN|demo\.mundodelplastico|demoEmail/), []);
  });

  it("no existe el proveedor ni el estado de la demostración", () => {
    assert.deepEqual(offenders(/DemoProvider|useDemo\b|demo-provider|mp-demo-role|panel-demo|DemoBadge/), []);
    assert.equal(existsSync(join(SRC, "lib", "panel-demo")), false);
    assert.equal(existsSync(join(SRC, "components", "panel", "demo-provider.tsx")), false);
  });

  it("el ingreso usa Supabase Auth y no guarda un perfil elegido a mano", () => {
    const login = readFileSync(join(SRC, "components", "panel", "login-form.tsx"), "utf8");
    assert.match(login, /useAuth\(\)/);
    assert.doesNotMatch(login, /chooseRole|radiogroup|setRole\(/);
    const auth = readFileSync(join(SRC, "components", "panel", "auth-provider.tsx"), "utf8");
    assert.match(auth, /signInWithPassword/);
    assert.match(auth, /from\("profiles"\)/);
    assert.doesNotMatch(auth, /sessionStorage|localStorage/);
  });

  it("el rol nunca se lee del token ni de user_metadata", () => {
    const panel = all.filter(({ f }) => /^(components[\\/]panel|lib[\\/](panel|users))[\\/]/.test(f));
    assert.deepEqual(panel.filter(({ text }) => /\.(user_metadata|app_metadata)\b|getClaims|jwtDecode/.test(text)).map(({ f }) => f), []);
  });

  it("no hay una sola sesión paralela: las compuertas usan la sesión del panel", () => {
    for (const f of ["components/panel/supabase-gate.tsx", "components/panel/pos/pos-gate.tsx"]) {
      const text = readFileSync(join(SRC, ...f.split("/")), "utf8");
      assert.match(text, /useSession\(\)/, f);
      assert.doesNotMatch(text, /signInWithPassword|getSession|onAuthStateChange/, f);
    }
  });

  it("la clave service_role no aparece en el código (salvo para advertir que no se use)", () => {
    const withKey = all.filter(({ text }) => /service_role/i.test(text));
    for (const { f, text } of withKey) {
      const lines = text.split("\n").filter((l) => /service_role/i.test(l));
      assert.ok(lines.every((l) => /^\s*(\/\/|\*|\/\*)/.test(l)), `${f}: service_role fuera de un comentario`);
    }
  });
});

describe("reevaluación de la sesión al volver a la pestaña", () => {
  const SRC = join(import.meta.dirname, "..", "src");
  const provider = readFileSync(join(SRC, "components", "panel", "auth-provider.tsx"), "utf8");
  const shell = readFileSync(join(SRC, "components", "panel", "panel-shell.tsx"), "utf8");

  it("shouldRefresh respeta el mínimo entre evaluaciones", () => {
    assert.equal(shouldRefresh(0, 1_000), false);
    assert.equal(shouldRefresh(0, REFRESH_MIN_GAP_MS), true);
    assert.equal(shouldRefresh(50_000, 50_000 + REFRESH_MIN_GAP_MS - 1), false);
    assert.equal(shouldRefresh(50_000, 50_000 + REFRESH_MIN_GAP_MS), true);
    assert.equal(shouldRefresh(0, 3_000, 1_000), true);
  });

  it("el proveedor reevalúa al volver a la pestaña y limpia sus escuchas", () => {
    for (const ev of ["visibilitychange", "focus", "pageshow"]) {
      assert.ok(provider.includes(`addEventListener("${ev}"`), `falta escuchar ${ev}`);
      assert.ok(provider.includes(`removeEventListener("${ev}"`), `falta quitar ${ev}`);
    }
    assert.match(provider, /document\.visibilityState === "hidden"/);
    assert.match(provider, /shouldRefresh\(/);
  });

  it("descarta el resultado de una evaluación vieja que termina después de una nueva", () => {
    assert.match(provider, /mine === latest\.current/);
  });

  it("una cuenta sin acceso (desactivada) saca del panel y vuelve al ingreso", () => {
    assert.match(shell, /state\.status === "out" \|\| state\.status === "forbidden"\) router\.replace\("\/panel\/login"\)/);
  });

  it("las operaciones no dependen de esto: el rol efectivo lo calcula la base", () => {
    // La reevaluación solo cambia lo que se ve. Los rechazos reales están probados en supabase/tests (usuario inactivo).
    assert.doesNotMatch(provider, /\.rpc\(/);
  });
});
