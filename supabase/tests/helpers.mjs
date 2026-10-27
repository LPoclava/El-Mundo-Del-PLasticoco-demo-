// Arnés de pruebas: PostgreSQL real (PGlite) con las migraciones del repositorio.
// Solo se simula lo propio de Supabase (roles anon/authenticated, auth.users, auth.uid(), storage).
// Nada de esto se conecta a Supabase ni a producción.
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export const ID = {
  ceo: "00000000-0000-4000-8000-000000000001",
  ceo2: "00000000-0000-4000-8000-000000000002",
  gerente: "00000000-0000-4000-8000-000000000003",
  empleado: "00000000-0000-4000-8000-000000000004",
  inactivo: "00000000-0000-4000-8000-000000000005",
  sinPerfil: "00000000-0000-4000-8000-000000000006",
  enStaffSinPerfil: "00000000-0000-4000-8000-000000000007",
};

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  create schema auth;
  create schema storage;
  grant usage on schema public, extensions, auth, storage to anon, authenticated;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), '')::uuid
  $$;

  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text, owner uuid
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to anon, authenticated;

  -- Supabase otorga todo a anon/authenticated sobre lo que se crea en public: las migraciones
  -- lo revocan, y las pruebas verifican que esas revocaciones funcionan.
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
}

export async function newDb() {
  const db = new PGlite({ extensions: { unaccent, pg_trgm } });
  await db.exec(SUPABASE_STUB);
  return db;
}

export async function applyMigrations(db, filter = () => true) {
  for (const f of migrationFiles().filter(filter)) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
}

/** Estado de producción antes de esta tanda: usuarios de Auth y la cuenta corporativa en staff. */
export async function seedAuthUsersAndStaff(db) {
  const rows = [
    [ID.ceo, "corporativa@aimpulse.test"],
    [ID.ceo2, "ceo2@example.test"],
    [ID.gerente, "gerente@example.test"],
    [ID.empleado, "empleado@example.test"],
    [ID.inactivo, "inactivo@example.test"],
    [ID.sinPerfil, "sinperfil@example.test"],
    [ID.enStaffSinPerfil, "enstaff@example.test"],
  ];
  for (const [id, email] of rows) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  }
  await db.query("insert into public.staff (user_id) values ($1)", [ID.ceo]);
}

/** Datos del catálogo creados como superusuario (como el SQL Editor). */
export async function seedCatalog(db) {
  await db.exec(`
    insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
      on conflict (id) do nothing;
    insert into public.categories (id, name, slug) values
      ('10000000-0000-4000-8000-000000000001', 'Baldes', 'baldes'),
      ('10000000-0000-4000-8000-000000000002', 'Vasos', 'vasos');
    -- P1: publicado, con foto y precio -> visible al público.
    insert into public.products (id, name, category_id, barcode, publish_enabled) values
      ('20000000-0000-4000-8000-000000000001', 'Balde 10L', '10000000-0000-4000-8000-000000000001', '7790001000011', true),
      ('20000000-0000-4000-8000-000000000002', 'Vaso largo', '10000000-0000-4000-8000-000000000002', '7790001000028', false);
    insert into public.product_variants (id, product_id, price, position) values
      ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1000, 0),
      ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 500, 0);
    insert into public.product_images (product_id, path, is_primary) values
      ('20000000-0000-4000-8000-000000000001', 'products/p1/a.webp', true);
  `);
}

export const P1 = "20000000-0000-4000-8000-000000000001";
export const P2 = "20000000-0000-4000-8000-000000000002";
export const V1 = "30000000-0000-4000-8000-000000000001";
export const V2 = "30000000-0000-4000-8000-000000000002";
export const CAT1 = "10000000-0000-4000-8000-000000000001";
export const CAT2 = "10000000-0000-4000-8000-000000000002";

/**
 * Ejecuta fn dentro de una transacción que SIEMPRE se revierte, con el rol de base indicado
 * (anon / authenticated) y los claims JWT del usuario, igual que PostgREST.
 * uid = null -> sin usuario. role = null -> superusuario (SQL Editor).
 */
export async function run(db, { uid = null, role = "authenticated", claims = {} } = {}, fn) {
  await db.exec("begin");
  try {
    if (role) {
      await db.exec(`set local role ${role}`);
      const jwt = { role, ...(uid ? { sub: uid } : {}), ...claims };
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(jwt)]);
    }
    const q = (sql, params) => db.query(sql, params);
    q.fails = async (sql, params, code) => {
      await db.exec("savepoint expected_failure");
      try {
        await db.query(sql, params);
      } catch (e) {
        await db.exec("rollback to savepoint expected_failure");
        if (code) assert.equal(e.code, code, `esperaba ${code} y fue ${e.code}: ${e.message}`);
        return e;
      }
      await db.exec("rollback to savepoint expected_failure");
      assert.fail(`la consulta debía fallar y se ejecutó: ${sql}`);
    };
    return await fn(q);
  } finally {
    await db.exec("rollback");
  }
}

export const asAnon = (db, fn) => run(db, { role: "anon" }, fn);
export const asUser = (db, uid, fn, claims) => run(db, { uid, claims }, fn);
export const asAdmin = (db, fn) => run(db, { role: null }, fn);
