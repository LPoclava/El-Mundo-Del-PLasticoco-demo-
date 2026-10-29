"use client";

import Link from "next/link";
import { DEMO_TODAY } from "@/lib/panel-demo/data";
import { describeEntry, visibleAudit } from "@/lib/panel-demo/audit";
import { formatDateTime } from "@/lib/panel-demo/format";
import { ROLE_LABEL, atLeast, historyTitle, type IconName, type Role } from "@/lib/panel-demo/roles";
import { useDemo } from "../demo-provider";
import { Icon } from "../icons";
import { Badge, CARD_CLASS, EmptyState, Notice, PageHeader } from "../ui";

const WEEK = 7 * 24 * 60 * 60 * 1000;

type Shortcut = { href: string; icon: IconName; title: string; text: string; min: Role };

const SHORTCUTS: Shortcut[] = [
  { href: "/panel/precios", icon: "barcode", title: "Vender con el escáner", text: "Escaneá, cobrá y descontá stock.", min: "empleado" },
  { href: "/panel/productos", icon: "box", title: "Gestionar productos", text: "Crear, editar, publicar o archivar.", min: "gerente" },
  { href: "/panel/categorias", icon: "tag", title: "Ordenar categorías", text: "Crear, renombrar o reasignar.", min: "gerente" },
  { href: "/panel/crm", icon: "chart", title: "Ver informes", text: "Resumen comercial de ejemplo.", min: "gerente" },
  { href: "/panel/historial", icon: "history", title: "Revisar cambios", text: "Quién hizo qué y cuándo.", min: "empleado" },
  { href: "/panel/usuarios", icon: "users", title: "Usuarios y permisos", text: "Altas, roles y estados.", min: "ceo" },
];

export function HomeSection() {
  const { state, role, actor } = useDemo();
  if (!role || !actor) return null;

  const live = state.products.filter((p) => !p.archived);
  const published = live.filter((p) => p.published).length;
  const scoped = visibleAudit(state.audit, role, actor.id);
  const since = Date.parse(DEMO_TODAY) - WEEK;
  const recentCount = scoped.filter((e) => Date.parse(e.at) >= since).length;

  const indicators = [
    { label: "Productos registrados", value: state.products.length },
    { label: "Productos publicados", value: published },
    { label: "Sin publicar", value: live.length - published },
    { label: role === "empleado" ? "Mis cambios (7 días)" : "Cambios (7 días)", value: recentCount },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de gestión"
        subtitle="Administrá productos, consultá precios y supervisá la actividad del negocio desde un solo lugar."
      />

      <Notice tone="demo" title={`Estás viendo la demo como ${ROLE_LABEL[role]}`}>
        Las cifras, productos y movimientos son ficticios y viven solo en esta pantalla. Recargar la página los restablece.
      </Notice>

      <section aria-label="Indicadores" className={`${CARD_CLASS} grid grid-cols-2 divide-brand-line md:grid-cols-4 md:divide-x`}>
        {indicators.map((i, idx) => (
          <div key={i.label} className={`px-5 py-4 ${idx > 1 ? "border-t border-brand-line md:border-t-0" : ""} ${idx % 2 === 1 ? "border-l border-brand-line md:border-l-0" : ""}`}>
            <p className="text-sm text-brand-muted">{i.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{i.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="actividad-titulo" className={CARD_CLASS}>
          <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-3">
            <h2 id="actividad-titulo" className="text-base font-semibold">
              {role === "empleado" ? "Mi actividad reciente" : "Actividad reciente"}
            </h2>
            <Link href="/panel/historial" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:decoration-2">
              {historyTitle(role)}
            </Link>
          </div>
          {scoped.length === 0 ? (
            <div className="p-5"><EmptyState title="Todavía no hay actividad">Los cambios que hagas en la demo aparecen acá.</EmptyState></div>
          ) : (
            <ul className="divide-y divide-brand-line">
              {scoped.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-sand text-brand-muted">
                    <Icon name={e.action === "create" ? "plus" : e.action === "link" ? "link" : e.action === "archive" ? "archive" : e.action === "user" ? "users" : e.action === "price" ? "barcode" : "edit"} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{describeEntry(e)}</p>
                    {(e.from || e.to) && (
                      <p className="mt-0.5 text-xs text-brand-muted tabular-nums">
                        {e.from && <span>{e.from}</span>}
                        {e.from && e.to && <span aria-hidden> → </span>}
                        {e.to && <span className="font-medium text-brand-ink">{e.to}</span>}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-brand-muted tabular-nums">{formatDateTime(e.at)}</p>
                    <Badge>{ROLE_LABEL[e.role]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="accesos-titulo" className={CARD_CLASS}>
          <h2 id="accesos-titulo" className="border-b border-brand-line px-5 py-3 text-base font-semibold">Accesos rápidos</h2>
          <ul className="divide-y divide-brand-line">
            {SHORTCUTS.filter((s) => atLeast(role, s.min)).map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-brand-cream">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15">
                    <Icon name={s.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.title}</span>
                    <span className="block text-xs text-brand-muted">{s.text}</span>
                  </span>
                  <Icon name="chevronRight" className="size-4 text-brand-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
