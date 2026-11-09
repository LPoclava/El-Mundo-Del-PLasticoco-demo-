"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { validateLogin, type LoginErrors } from "@/lib/panel/session";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";
import { Button, Field, INPUT_CLASS, Notice } from "./ui";

/** Inicio de sesión del panel con Supabase Auth (correo y contraseña). No hay otro mecanismo de ingreso. */
export function LoginForm() {
  const router = useRouter();
  const { state, signIn, signOut, retry } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Con una sesión válida no hay nada que hacer acá: se va al panel.
  useEffect(() => {
    if (state.status === "in") router.replace("/panel");
  }, [state.status, router]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (loading) return;
    const found = validateLogin(email, password);
    setErrors(found);
    setFailure(null);
    if (found.email || found.password) return;
    setLoading(true);
    const message = await signIn(email, password);
    setLoading(false);
    if (message) {
      setFailure(message);
      setPassword("");
      return;
    }
    router.replace("/panel");
  }

  if (state.status === "loading" || state.status === "in") {
    return <BrandLoader fullscreen label={state.status === "in" ? "Entrando al panel…" : "Recuperando tu sesión…"} />;
  }

  return (
    <div className="min-h-dvh bg-brand-cream lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden border-r border-brand-line bg-white px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div>
          <Image src="/brand/logo-horizontal.png" alt="El Mundo del Plástico" width={900} height={329} sizes="156px" className="h-12 w-auto" preload />
          {/* Es un texto y no un título: el único título de la página es «Panel de administración». */}
          <p className="mt-10 max-w-sm text-2xl font-semibold tracking-tight text-balance">
            El panel del negocio, a la medida de cada persona del equipo.
          </p>
          <p className="mt-3 max-w-sm text-brand-muted">
            Cada cuenta ve y puede hacer solo lo que su rol permite.
          </p>
        </div>
      </aside>

      <main id="contenido" className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex lg:hidden" aria-label="Mundo del Plástico — catálogo">
            <Image src="/brand/logo-horizontal.png" alt="El Mundo del Plástico" width={900} height={329} sizes="156px" className="h-12 w-auto" preload />
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="mt-1 text-brand-muted">Ingresá para gestionar el catálogo, las ventas y el stock.</p>

          {state.status === "unconfigured" && (
            <div className="mt-6">
              <Notice tone="warn" title="Falta configurar la conexión">
                Sin la conexión con la base de datos no se puede iniciar sesión. Avisá a quien administra el sistema.
              </Notice>
            </div>
          )}

          {state.status === "error" && (
            <div className="mt-6 space-y-3">
              <Notice tone="warn" title="No pudimos verificar tu sesión">{state.message} Revisá la conexión e intentá de nuevo.</Notice>
              <Button icon="refresh" onClick={retry}>Reintentar</Button>
            </div>
          )}

          {state.status === "forbidden" && (
            <div className="mt-6 space-y-3">
              <Notice tone="warn" title="Esta cuenta no tiene acceso al panel">
                {state.email ? `${state.email}: ` : ""}pedile a un responsable que te dé acceso.
              </Notice>
              <Button onClick={() => void signOut()}>Usar otra cuenta</Button>
            </div>
          )}

          {state.status === "out" && (
            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
              {failure && (
                <div role="alert">
                  <Notice tone="warn">{failure}</Notice>
                </div>
              )}

              <Field label="Correo electrónico" error={errors.email}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id} type="email" inputMode="email" autoComplete="username" spellCheck={false} autoFocus
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS}
                  />
                )}
              </Field>

              <Field label="Contraseña" error={errors.password}>
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <input
                      id={id} type={showPassword ? "text" : "password"} autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      aria-describedby={describedBy} aria-invalid={invalid} className={`${INPUT_CLASS} pr-12`}
                    />
                    <button
                      type="button" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}
                      className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-brand-muted hover:bg-brand-sand hover:text-brand-ink"
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
              <p className="sr-only" role="status">{loading ? "Ingresando" : ""}</p>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link href="/" className="inline-flex min-h-11 items-center text-brand-muted underline underline-offset-4 hover:text-brand-ink">Volver al catálogo</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
