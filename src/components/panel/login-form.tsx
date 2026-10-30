"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  DEMO_EMAIL_DOMAIN, ROLES, ROLE_LABEL, ROLE_SUMMARY, demoEmail, type Role,
} from "@/lib/panel-demo/roles";
import { useDemo } from "./demo-provider";
import { Icon } from "./icons";
import { Button, Field, INPUT_CLASS, Notice } from "./ui";

/**
 * Inicio de sesión de DEMOSTRACIÓN. No autentica contra Supabase ni contra ningún servidor:
 * el correo y la contraseña no se envían ni se guardan. Solo se aceptan correos de ejemplo
 * (@demo.mundodelplastico.test) para que nadie use aquí credenciales reales.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_PASSWORD = "demo-1234";

type Errors = { email?: string; password?: string; form?: string };

export function LoginForm() {
  const router = useRouter();
  const demo = useDemo();
  const roleGroup = useId();
  const [role, setRole] = useState<Role>("gerente");
  const [email, setEmail] = useState(demoEmail("gerente"));
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  function chooseRole(next: Role) {
    setRole(next);
    // Solo se reescribe el correo si todavía es uno de los de ejemplo.
    if (!email.trim() || email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) setEmail(demoEmail(next));
    setErrors({});
  }

  function validate(): Errors {
    const e: Errors = {};
    const mail = email.trim().toLowerCase();
    if (!mail) e.email = "Ingresá tu correo electrónico.";
    else if (!EMAIL_RE.test(mail)) e.email = "El correo no tiene un formato válido.";
    else if (!mail.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
      e.email = `En la demo solo se aceptan correos @${DEMO_EMAIL_DOMAIN}. Elegí un perfil para completarlo.`;
    }
    if (!password) e.password = "Ingresá una contraseña (en la demo no se verifica).";
    return e;
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (loading) return;
    const found = validate();
    setErrors(found);
    if (found.email || found.password) return;
    setLoading(true);
    // Retardo breve para mostrar el estado de carga; no hay ninguna llamada de red.
    setTimeout(() => {
      demo.signIn(role);
      router.push("/panel");
    }, 700);
  }

  return (
    <div className="min-h-dvh bg-brand-cream lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden bg-brand-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <span className="inline-flex rounded-lg bg-white px-3 py-2">
            <Image src="/brand/logo-horizontal.png" alt="El Mundo del Plástico" width={900} height={329} className="h-12 w-auto" preload />
          </span>
          <h2 className="mt-10 max-w-sm text-3xl font-semibold tracking-tight text-balance">
            Gestión del catálogo, a la medida de cada persona del equipo.
          </h2>
          <p className="mt-3 max-w-sm text-white/75">
            Esta demostración muestra cómo trabajaría cada perfil. Elegí uno para recorrer el panel.
          </p>
        </div>
        <ul className="space-y-5">
          {ROLES.map((r) => (
            <li key={r} className="max-w-sm">
              <p className="text-sm font-semibold">{ROLE_LABEL[r]}</p>
              <p className="mt-0.5 text-sm text-white/70">{ROLE_SUMMARY[r]}</p>
            </li>
          ))}
        </ul>
      </aside>

      <main id="contenido" className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex lg:hidden" aria-label="Mundo del Plástico — catálogo">
            <Image src="/brand/logo-horizontal.png" alt="El Mundo del Plástico" width={900} height={329} className="h-12 w-auto" preload />
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="mt-1 text-brand-muted">Ingresá para gestionar productos y precios.</p>

          <div className="mt-5">
            <Notice tone="demo" title="Demostración">
              Este acceso es de prueba y no es una medida de seguridad. No se conecta con Supabase: no ingreses datos ni contraseñas reales.
            </Notice>
          </div>

          {demo.status === "in" && demo.role && (
            <p className="mt-4 text-sm">
              Ya hay una demo abierta como {ROLE_LABEL[demo.role]}.{" "}
              <Link href="/panel" className="font-medium underline underline-offset-4">Continuar</Link>
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Perfil de demostración</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Perfil de demostración">
                {ROLES.map((r) => (
                  <label key={r} className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-medium has-[:checked]:border-brand-ink has-[:checked]:bg-white has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-brand-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink border-brand-line bg-white/60 hover:border-brand-ink`}>
                    <input type="radio" name={roleGroup} value={r} checked={role === r} onChange={() => chooseRole(r)} className="sr-only" />
                    {ROLE_LABEL[r]}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-brand-muted">{ROLE_SUMMARY[role]}</p>
            </fieldset>

            <Field label="Correo electrónico" error={errors.email}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id} type="email" inputMode="email" autoComplete="off" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS}
                  placeholder={`perfil@${DEMO_EMAIL_DOMAIN}`}
                />
              )}
            </Field>

            <Field label="Contraseña" error={errors.password}>
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <input
                    id={id} type={showPassword ? "text" : "password"} autoComplete="off"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    aria-describedby={describedBy} aria-invalid={invalid} className={`${INPUT_CLASS} pr-12`}
                  />
                  <button
                    type="button" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}
                    className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-md text-brand-muted hover:bg-brand-sand hover:text-brand-ink"
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} className="size-4" />
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-brand-ink/30 border-t-brand-ink motion-reduce:animate-none" />
                  Ingresando…
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
            <p className="sr-only" role="status">{loading ? "Ingresando a la demostración" : ""}</p>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-brand-muted underline underline-offset-4 hover:text-brand-ink">Volver al catálogo</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
