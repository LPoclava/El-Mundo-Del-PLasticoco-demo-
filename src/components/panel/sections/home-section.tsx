"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand-loader";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import { listSales, type SaleListItem } from "@/lib/pos/api";
import {
  LOW_STOCK_THRESHOLD, lowStock, recentMovements, salesSummary, todayRange,
  type LowStockItem, type MovementItem, type SalesSummary,
} from "@/lib/pos/dashboard";
import type { IconName } from "@/lib/panel/roles";
import { Icon } from "../icons";
import { Badge, CARD_CLASS, Notice, PageHeader } from "../ui";
import { PosGate } from "../pos/pos-gate";

type Role = "empleado" | "gerente" | "ceo";

const time = new Intl.DateTimeFormat("es-AR", { timeStyle: "short" });
const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

type Shortcut = { href: string; icon: IconName; title: string; text: string; manager: boolean };

const SHORTCUTS: Shortcut[] = [
  { href: "/panel/precios", icon: "barcode", title: "Escáner", text: "Consultar, vender, registrar y cargar stock.", manager: false },
  { href: "/panel/productos", icon: "box", title: "Productos", text: "Completar fichas, precios, fotos y publicación.", manager: true },
  { href: "/panel/categorias", icon: "tag", title: "Categorías", text: "Las cuatro principales: nombre, foto y orden.", manager: true },
  { href: "/panel/banners", icon: "image", title: "Banners promocionales", text: "Carrusel del catálogo.", manager: true },
];

/** Inicio del panel: actividad comercial REAL del día. Sin datos, no se inventan cifras. */
export function HomeSection() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Dashboard" subtitle="Resumen general del negocio: ventas, unidades y stock del día." />
      <PosGate>{({ db, role }) => <Dashboard db={db} role={role} />}</PosGate>
    </div>
  );
}

type Data = {
  summary: SalesSummary;
  sales: SaleListItem[];
  low: LowStockItem[] | null;
  movements: MovementItem[] | null;
};

function Dashboard({ db, role }: { db: SupabaseClient; role: Role }) {
  const manager = role !== "empleado";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = todayRange();
    Promise.all([
      salesSummary(db, from, to),
      listSales(db, { from: null, to: null, method: "" }),
      manager ? lowStock(db) : Promise.resolve(null),
      manager ? recentMovements(db) : Promise.resolve(null),
    ])
      .then(([summary, sales, low, movements]) => {
        if (!cancelled) setData({ summary, sales: sales.slice(0, 5), low, movements });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "No se pudo cargar el inicio."));
    return () => {
      cancelled = true;
    };
  }, [db, manager]);

  if (error) return <Notice tone="warn" title="No se pudo cargar el inicio">{error}</Notice>;
  if (!data) return <BrandLoader label="Cargando la actividad del día…" />;

  const { summary } = data;
  const mine = manager ? "" : " (tuyas)";
  const kpis = [
    { label: `Ventas de hoy${mine}`, value: String(summary.salesCount) },
    { label: `Facturación del día${mine}`, value: formatPrice(summary.revenue) },
    { label: `Unidades vendidas${mine}`, value: String(summary.units) },
    ...(manager && data.low ? [{ label: `Variantes con ${LOW_STOCK_THRESHOLD} o menos`, value: String(data.low.length) }] : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section aria-label="Indicadores del día" className={`${CARD_CLASS} grid grid-cols-2 md:grid-cols-4`}>
        {kpis.map((k, i) => (
          <div key={k.label} className={`px-5 py-4 ${i > 1 ? "border-t border-brand-line md:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-brand-line" : ""} ${i > 0 ? "md:border-l md:border-brand-line" : ""}`}>
            <p className="text-sm text-brand-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas ventas" link={{ href: "/panel/precios", label: "Ir al escáner" }}>
          {data.sales.length === 0 ? (
            <Empty>Todavía no hay ventas registradas.</Empty>
          ) : (
            <ul className="divide-y divide-brand-line">
              {data.sales.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">#{s.number} · {formatPrice(s.total)}</p>
                    <p className="truncate text-xs text-brand-muted">{s.lines.map((l) => `${l.quantity} × ${l.productName}`).join(", ")}</p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-brand-muted">{dateTime.format(new Date(s.createdAt))}{manager ? ` · ${s.userName}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Más vendidos hoy">
          {summary.topProducts.length === 0 ? (
            <Empty>Hoy todavía no se vendió nada.</Empty>
          ) : (
            <ol className="divide-y divide-brand-line">
              {summary.topProducts.map((t, i) => (
                <li key={`${t.name}-${t.variant ?? ""}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0"><span className="mr-2 tabular-nums text-brand-muted">{i + 1}.</span>{t.name}{t.variant ? ` (${t.variant})` : ""}</span>
                  <span className="shrink-0 font-medium tabular-nums">{t.units} u.</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {manager && data.low && (
          <Panel title={`Stock bajo (${LOW_STOCK_THRESHOLD} o menos)`} link={{ href: "/panel/productos", label: "Ver productos" }}>
            {data.low.length === 0 ? (
              <Empty>Ninguna variante está por debajo del umbral.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {data.low.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0">{l.name}{l.variant ? ` (${l.variant})` : ""}</span>
                    <Badge tone={l.stock === 0 ? "danger" : "warn"}>{l.stock === 0 ? "Sin stock" : `${l.stock} u.`}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {manager && data.movements && (
          <Panel title="Actividad de inventario">
            {data.movements.length === 0 ? (
              <Empty>Todavía no hay movimientos de stock.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {data.movements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p>
                        <Badge tone={m.reason === "venta" ? "muted" : m.reason === "entrada" ? "ok" : "warn"}>{REASON[m.reason]}</Badge>{" "}
                        {m.productName ?? "Producto eliminado"}{m.variant ? ` (${m.variant})` : ""}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-brand-muted">
                        {m.stockBefore} → {m.stockAfter} ({m.delta > 0 ? "+" : ""}{m.delta}){m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs tabular-nums text-brand-muted">{time.format(new Date(m.createdAt))}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <Notice title="Consultas por WhatsApp">
        Todavía no se registran: el botón del catálogo solo abre WhatsApp y no hay una fuente de datos de consultas. Cuando exista,
        este indicador se suma acá.
      </Notice>

      <section aria-labelledby="accesos-titulo" className={CARD_CLASS}>
        <h2 id="accesos-titulo" className="border-b border-brand-line px-5 py-3 text-base font-semibold">Accesos rápidos</h2>
        <ul className="divide-y divide-brand-line">
          {SHORTCUTS.filter((s) => manager || !s.manager).map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-brand-cream">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15"><Icon name={s.icon} className="size-5" /></span>
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
  );
}

const REASON: Record<MovementItem["reason"], string> = { venta: "Venta", entrada: "Entrada", ajuste: "Ajuste", inicial: "Alta" };

function Panel({ title, link, children }: { title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className={CARD_CLASS} aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {link && <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:decoration-2">{link.label}</Link>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-brand-muted">{children}</p>;
}
