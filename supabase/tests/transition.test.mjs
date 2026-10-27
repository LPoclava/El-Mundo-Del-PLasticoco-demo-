// Verifica cómo se combinan las políticas durante la transición (políticas permisivas = OR).
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  ID, P1, newDb, applyMigrations, seedAuthUsersAndStaff, seedCatalog, asUser, asAnon, asAdmin,
} from "./helpers.mjs";

describe("combinación de políticas durante la transición", () => {
  it("con staff_all y las políticas nuevas a la vez, el acceso es la UNIÓN (no la intersección)", async () => {
    const db = await newDb();
    await applyMigrations(db, (f) => f < "20261029");
    await seedAuthUsersAndStaff(db);
    // Hasta la migración 4: staff_all sigue activa y todavía no hay políticas nuevas en el catálogo.
    await applyMigrations(db, (f) => f >= "20261029" && f <= "20261029000004");
    await seedCatalog(db);
    await db.query("insert into public.profiles (user_id, display_name, role, active) values ($1, 'Inactivo', 'empleado', false)", [ID.inactivo]);
    await db.query("insert into public.staff (user_id) values ($1)", [ID.inactivo]);

    // Un usuario inactivo que todavía figura en staff conserva acceso TOTAL por staff_all.
    await asUser(db, ID.inactivo, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.products")).rows[0].n), 2);
    });

    // Agregar una política nueva restrictiva-en-intención NO le quita ese acceso: se suman.
    await db.exec("create policy gerente_all on public.products for all to authenticated using ((select public.has_role_at_least('gerente')))");
    await asUser(db, ID.inactivo, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.products")).rows[0].n), 2);
    });
    await db.exec("drop policy gerente_all on public.products");

    // Con las migraciones 5 y 6 (que borran staff_all en la misma transacción) pierde el acceso.
    await applyMigrations(db, (f) => f >= "20261029000005");
    await asUser(db, ID.inactivo, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.products")).rows[0].n), 0);
    });
  });

  it("durante la transición la cuenta corporativa conserva el acceso en cada paso", async () => {
    const db = await newDb();
    await applyMigrations(db, (f) => f < "20261029");
    await seedAuthUsersAndStaff(db);
    await seedCatalog(db);
    const steps = (await import("./helpers.mjs")).migrationFiles().filter((f) => f >= "20261029");
    for (const f of steps) {
      await applyMigrations(db, (x) => x === f);
      await asUser(db, ID.ceo, async (q) => {
        const n = Number((await q("select count(*) n from public.products")).rows[0].n);
        // Antes de la migración 5 entra por staff_all; desde la 3 también por su perfil de CEO.
        assert.equal(n, 2, `sin acceso al catálogo después de ${f}`);
      });
    }
  });
});

describe("reversión", () => {
  const ROLLBACK = join(dirname(fileURLToPath(import.meta.url)), "..", "rollback", "20261029_rollback_roles.sql");
  const CLOSE = join(dirname(fileURLToPath(import.meta.url)), "..", "pending", "20261029000099_close_drop_staff.sql");

  async function migrated() {
    const db = await newDb();
    await applyMigrations(db, (f) => f < "20261029");
    await seedAuthUsersAndStaff(db);
    await applyMigrations(db, (f) => f >= "20261029");
    await seedCatalog(db);
    await db.query("insert into public.profiles (user_id, display_name, role) values ($1, 'G', 'gerente')", [ID.gerente]);
    return db;
  }

  it("vuelve a staff sin perder productos, auditoría ni acceso del CEO", async () => {
    const db = await migrated();
    const auditBefore = Number((await db.query("select count(*) n from public.audit_log")).rows[0].n);
    await db.exec(readFileSync(ROLLBACK, "utf8"));

    await asUser(db, ID.ceo, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.products")).rows[0].n), 2);
      assert.equal((await q("select public.is_staff() as s")).rows[0].s, true);
      await q("update public.products set name = 'Balde' where id = $1", [P1]);
    });
    // El gerente deja de tener acceso (el modelo viejo no lo conoce).
    await asUser(db, ID.gerente, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.products")).rows[0].n), 0);
    });
    await asAdmin(db, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.audit_log")).rows[0].n) >= auditBefore, true);
      assert.equal(Number((await q("select count(*) n from public.profiles")).rows[0].n), 2);
      assert.equal(Number((await q("select count(*) n from public.product_variants")).rows[0].n), 2);
      assert.equal(Number((await q("select count(*) n from public.product_images")).rows[0].n), 1);
    });
    // El catálogo público sigue funcionando.
    await asAnon(db, async (q) => {
      assert.equal(Number((await q("select count(*) n from public.public_catalog")).rows[0].n), 1);
    });
  });

  it("se niega a revertir si el cierre ya borró staff_legacy, y el cierre exige un CEO activo", async () => {
    const db = await migrated();
    await db.exec(readFileSync(CLOSE, "utf8"));
    await assert.rejects(db.exec(readFileSync(ROLLBACK, "utf8")), /staff_legacy no existe/);
  });

  it("el cierre no se aplica si no hay CEO activo", async () => {
    const db = await migrated();
    await db.exec("alter table public.profiles disable trigger profiles_guard; update public.profiles set active = false where role = 'ceo'; alter table public.profiles enable trigger profiles_guard;");
    await assert.rejects(db.exec(readFileSync(CLOSE, "utf8")), /No hay un CEO activo/);
  });
});
