"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ROLE_LABEL, ROLE_SUMMARY, menuGroups, sectionOf, type GroupId, type Role,
} from "@/lib/panel/roles";
import { BrandLoader } from "@/components/brand-loader";
import { DRAFT_KEY, hasDraft } from "@/lib/pos/draft";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";
import { Button, Dialog, Notice } from "./ui";

/** Estructura del panel: navegación lateral, barra superior y contenido. La sesión y el rol son los reales (Supabase). */

/** Quién tiene la sesión abierta, para mostrarlo en el menú y el perfil. */
type Actor = { name: string; email: string };

/** Sección a la que pertenece una dirección; las pantallas internas (/panel/productos/nuevo) cuentan como su sección. */
/** Pantallas en modo inmersivo (sin menú lateral). */
const IMMERSIVE = ["/panel/precios", "/panel/stock"];

function sectionTitle(pathname: string): string {
  return sectionOf(pathname)?.label ?? "Panel";
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-semibold text-brand-ink">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Menú por grupos desplegables. El grupo de la sección actual se abre solo y queda resaltado; abrir o cerrar
 * anima la altura (filas de grilla 0fr → 1fr, sin medir nada) y gira la flecha. Con el menú contraído (solo
 * íconos) no hay encabezados de grupo: se ve la lista plana.
 */
function Navigation({ role, collapsed, onNavigate }: { role: Role; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const current = sectionOf(pathname);
  const groups = menuGroups(role);
  // El usuario puede abrir o cerrar a mano; el grupo de la página actual siempre está abierto.
  const [manual, setManual] = useState<Partial<Record<GroupId, boolean>>>({});

  return (
    <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto px-3 py-2">
      <div className="flex flex-col gap-1">
        {groups.map((g) => {
          const holdsCurrent = g.items.some((s) => s.id === current?.id);
          const open = collapsed || holdsCurrent || (manual[g.id] ?? true);
          const panelId = `menu-${g.id}`;
          return (
            <div key={g.id}>
              {!collapsed && (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  disabled={holdsCurrent}
                  onClick={() => setManual((m) => ({ ...m, [g.id]: !open }))}
                  className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-brand-sand disabled:cursor-default disabled:hover:bg-transparent ${holdsCurrent ? "text-brand-green-ink" : "text-brand-muted"}`}
                >
                  {g.label}
                  <Icon name="chevronDown" className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-0" : "-rotate-90"} ${holdsCurrent ? "opacity-40" : ""}`} />
                </button>
              )}
              <div
                id={panelId}
                className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <ul className="overflow-hidden" inert={!open || undefined}>
                  {g.items.map((s) => {
                    const active = current?.id === s.id;
                    return (
                      <li key={s.id} className="py-0.5">
                        <Link
                          href={s.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? s.label : undefined}
                          className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-brand-sand active:bg-brand-green/15 ${active ? "bg-brand-green/10 text-brand-green-ink" : "text-brand-ink/80"} ${collapsed ? "justify-center px-0" : "pl-4"}`}
                        >
                          {/* Indicador discreto de la sección actual. */}
                          {active && <span aria-hidden className="absolute left-0 top-2.5 h-6 w-1 rounded-full bg-brand-green" />}
                          <Icon name={s.icon} className={active ? "text-brand-green" : "text-brand-muted"} />
                          <span className={collapsed ? "sr-only" : "truncate"}>{s.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function SidebarBody({ actor, role, collapsed, onNavigate, onSignOut, onToggle }: {
  actor: Actor; role: Role; collapsed: boolean; onNavigate: () => void; onSignOut: () => void; onToggle?: () => void;
}) {
  return (
    <>
      <div aria-hidden className="flex h-1 shrink-0">
        <span className="w-16 bg-brand-orange" />
        <span className="w-8 bg-brand-green" />
      </div>
      <div className="px-3 pt-4">
        <Link href="/panel" onClick={onNavigate} aria-label="Mundo del Plástico — Inicio del panel" className="flex min-h-12 items-center justify-center rounded-lg px-2 py-1.5">
          {collapsed ? (
            <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="32px" className="size-8" />
          ) : (
            <Image src="/brand/logo-horizontal.png" alt="" width={900} height={329} sizes="110px" className="h-10 w-auto" />
          )}
        </Link>
        {!collapsed && <p className="mt-1 px-1 text-xs text-brand-muted">Panel de administración</p>}
      </div>

      <Navigation role={role} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="border-t border-brand-line p-3">
        <div className={`flex items-center gap-3 px-1 py-1 ${collapsed ? "justify-center" : ""}`} title={collapsed ? `${actor.name} · ${ROLE_LABEL[role]}` : undefined}>
          <Avatar name={actor.name} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-ink">{actor.name}</p>
              <p className="text-xs text-brand-muted">{ROLE_LABEL[role]}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={`mt-2 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-brand-ink/80 hover:bg-brand-sand ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Icon name="logout" />
          <span className={collapsed ? "sr-only" : ""}>Cerrar sesión</span>
        </button>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            aria-expanded={!collapsed}
            className={`mt-1 hidden h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-brand-muted hover:bg-brand-sand hover:text-brand-ink lg:flex ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
            <span className={collapsed ? "sr-only" : ""}>Contraer menú</span>
          </button>
        )}
      </div>
    </>
  );
}

function ProfileMenu({ actor, role, onSignOut }: { actor: Actor; role: Role; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex h-11 w-full items-center gap-3 px-4 text-left text-sm hover:bg-brand-sand";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-lg px-2 hover:bg-brand-sand"
      >
        <Avatar name={actor.name} />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-medium leading-tight">{actor.name}</span>
          <span className="block text-xs leading-tight text-brand-muted">{ROLE_LABEL[role]}</span>
        </span>
        <Icon name="chevronDown" className="size-4 text-brand-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-brand-line bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); setProfileOpen(true); }}>
            <Icon name="user" className="size-4" /> Ver mi perfil
          </button>
          <button role="menuitem" type="button" className={`${item} border-t border-brand-line`} onClick={() => { setOpen(false); onSignOut(); }}>
            <Icon name="logout" className="size-4" /> Cerrar sesión
          </button>
        </div>
      )}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} title="Mi perfil">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-brand-muted">Nombre</dt><dd>{actor.name}</dd>
          <dt className="text-brand-muted">Rol</dt><dd>{ROLE_LABEL[role]}</dd>
          <dt className="text-brand-muted">Correo</dt><dd className="break-all">{actor.email}</dd>
          <dt className="text-brand-muted">Alcance</dt><dd>{ROLE_SUMMARY[role]}</dd>
        </dl>
        <div className="mt-4">
          <Notice tone="info">Tu rol define qué secciones ves y qué operaciones acepta la base de datos.</Notice>
        </div>
      </Dialog>
    </div>
  );
}

export function PanelShell({ children }: { children: ReactNode }) {
  const { state, signOut: endSession, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Sin una sesión válida, o con una cuenta que ya no tiene acceso (por ejemplo, desactivada), el panel no se muestra:
  // se vuelve al inicio de sesión, que explica el motivo.
  useEffect(() => {
    if (state.status === "out" || state.status === "forbidden") router.replace("/panel/login");
  }, [state.status, router]);

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (state.status === "error" || state.status === "unconfigured") {
    return (
      <main id="contenido" className="flex min-h-dvh items-center justify-center bg-brand-cream px-4 py-10">
        <div className="w-full max-w-md space-y-4">
          {state.status === "error" && (
            <Notice tone="warn" title="No pudimos verificar tu sesión">{state.message} Revisá la conexión e intentá de nuevo.</Notice>
          )}
          {state.status === "unconfigured" && (
            <Notice tone="warn" title="Falta configurar la conexión">
              Sin la conexión con la base de datos el panel no puede funcionar. Avisá a quien administra el sistema.
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            {state.status === "error" && <Button icon="refresh" onClick={retry}>Reintentar</Button>}
            {state.status === "error" && (
              <Button onClick={() => void endSession().then(() => router.replace("/panel/login"))}>Cerrar sesión</Button>
            )}
          </div>
        </div>
      </main>
    );
  }
  if (state.status !== "in") {
    return <BrandLoader fullscreen label={state.status === "out" || state.status === "forbidden" ? "Volviendo al inicio de sesión…" : "Cargando el panel…"} />;
  }

  const role = state.profile.role;
  const actor: Actor = { name: state.profile.displayName, email: state.email };

  const signOut = () => {
    // Cerrar sesión con una venta armada la descartaría: se pregunta antes.
    if (hasDraft() && !window.confirm("Tenés una venta armada sin registrar. Si cerrás sesión se pierde. ¿Cerrar sesión igual?")) return;
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Sin almacenamiento no hay borrador que limpiar.
    }
    setMobileOpen(false);
    void endSession().then(() => router.replace("/panel/login"));
  };

  // Modo inmersivo: las operaciones que piden concentración (escáner, ventas y stock) ocultan el menú y
  // usan toda la pantalla; una salida fija lleva al inicio del panel.
  const immersive = IMMERSIVE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <div className="min-h-dvh bg-brand-cream lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-brand-ink focus:px-4 focus:py-2 focus:text-white">
        Saltar al contenido
      </a>

      <aside
        aria-label="Menú lateral"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-brand-line bg-white text-brand-ink transition-[width] duration-200 motion-reduce:transition-none ${immersive ? "" : "lg:flex"} ${collapsed ? "w-[4.75rem]" : "w-64"}`}
      >
        <SidebarBody actor={actor} role={role} collapsed={collapsed} onNavigate={() => {}} onSignOut={signOut} onToggle={() => setCollapsed((v) => !v)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-brand-ink/50" />
          <aside aria-label="Menú" className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white text-brand-ink">
            <button ref={closeRef} type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-sand">
              <Icon name="x" />
            </button>
            <SidebarBody actor={actor} role={role} collapsed={false} onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center sm:h-16 gap-2 border-b border-brand-line bg-white px-3 sm:px-6">
          {immersive ? (
            <Link
              href="/panel"
              onClick={(e) => {
                // La venta armada se conserva en esta pestaña, pero se avisa antes de dejarla.
                if (hasDraft() && !window.confirm("Tenés una venta armada sin registrar. Se conserva en esta pestaña hasta que la registres o cierres sesión. ¿Salir del escáner?")) e.preventDefault();
              }}
              className="-ml-1 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-brand-sand"
            >
              <Icon name="chevronLeft" className="size-4" />
              Salir<span className="hidden sm:inline">&nbsp;al panel</span>
            </Link>
          ) : (
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú" aria-expanded={mobileOpen} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-brand-sand lg:hidden">
              <Icon name="menu" />
            </button>
          )}
          <p className="min-w-0 flex-1 truncate text-base font-semibold">{sectionTitle(pathname)}</p>
          <ProfileMenu actor={actor} role={role} onSignOut={signOut} />
        </header>
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function NotAvailable({ role }: { role: Role }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border border-brand-line bg-white p-6 text-center">
        <span className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-brand-sand text-brand-muted">
          <Icon name="lock" />
        </span>
        <h1 className="mt-3 text-xl font-semibold">Sección fuera de tu perfil</h1>
        <p className="mt-1 text-brand-muted">
          Tu rol «{ROLE_LABEL[role]}» no incluye esta sección. Si la necesitás, pedile el acceso a un responsable.
        </p>

        <div className="mt-5">
          <Link href="/panel" className="inline-flex h-11 items-center rounded-lg bg-brand-orange px-4 text-sm font-medium text-brand-ink hover:bg-brand-orange/85">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}


