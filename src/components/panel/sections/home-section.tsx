"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLoader } from "@/components/brand-loader";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import { listSales, type SaleListItem } from "@/lib/pos/api";
import {
  PERIOD_LABEL, averageTicket, compareMonths, monthKey, periodRange,
  type Activity, type PeriodKind,
} from "@/lib/pos/analytics";
import {
  LOW_STOCK_THRESHOLD, listMovements, lowStock, salesByPaymentMethod, salesMonthlyByPaymentMethod, salesSummary,
  type LowStockItem, type MovementRow2, type PaymentAnalysis, type SalesSummary,
} from "@/lib/pos/dashboard";
import { saleToReceipt, type ReceiptLike } from "@/lib/pos/receipt";
import type { MonthlyRow } from "@/lib/pos/analytics";
import type { IconName } from "@/lib/panel/roles";
import { Icon } from "../icons";
import { Badge, CARD_CLASS, Notice, PageHeader } from "../ui";
import { PosGate } from "../pos/pos-gate";
import { ReceiptDialog } from "../pos/receipt-view";
import { ActivityPanel, Empty, KpiGrid, MonthlyPanel, Panel, PaymentPanel, PeriodPicker, type Kpi } from "./dashboard-parts";

type Role = "empleado" | "gerente" | "ceo";

const REASON: Record<MovementRow2["reason"], Activity["kind"]> = { venta: "venta", entrada: "entrada", ajuste: "ajuste", inicial: "alta" };

type Shortcut = { href: string; icon: IconName; title: string; text: string; manager: boolean };

const SHORTCUTS: Shortcut[] = [
  { href: "/panel/precios", icon: "barcode", title: "Escáner", text: "Consultar, vender, registrar y cargar stock.", manager: false },
  { href: "/panel/productos", icon: "box", title: "Productos", text: "Completar fichas, precios, fotos y publicación.", manager: true },
  { href: "/panel/categorias", icon: "tag", title: "Categorías", text: "Las cuatro principales: nombre, foto y orden.", manager: true },
  { href: "/panel/banners", icon: "image", title: "Banners promocionales", text: "Carrusel del catálogo.", manager: true },
];

/**
 * Inicio del panel: actividad comercial REAL del período elegido (por defecto, hoy). Sin datos no se inventan cifras ni
 * porcentajes. Cada indicador tiene una definición única (ver src/lib/pos/analytics.ts) que se muestra debajo de la cifra.
 * Los permisos los aplica la base: el empleado ve solo sus ventas; el gerente y el CEO, las de todo el equipo.
 */
export function HomeSection() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Dashboard" subtitle="Ventas, facturación, medios de pago y stock del negocio." />
      <PosGate>{({ db, role }) => <Dashboard db={db} role={role} />}</PosGate>
    </div>
  );
}

type PeriodData = { key: string; summary: SalesSummary; payments: PaymentAnalysis };
type SideData = { low: LowStockItem[] | null; sales: SaleListItem[]; movements: MovementRow2[] | null; monthly: MonthlyRow[] };
type Failure = { key: string; message: string };

function Dashboard({ db, role }: { db: SupabaseClient; role: Role }) {
  const manager = role !== "empleado";
  const [kind, setKind] = useState<PeriodKind>("hoy");
  const [custom, setCustom] = useState({ from: "", to: "" });
  // El momento de referencia se fija al entrar (y no cambia a mitad de la visita: los períodos «hoy» y «mes» son estables).
  const [now] = useState(() => new Date());
  const range = useMemo(() => periodRange(kind, now, custom), [kind, now, custom]);
  // Última selección válida: si las fechas elegidas todavía no sirven, se sigue mostrando el período anterior.
  const [lastValid, setLastValid] = useState(range);
  if (range && range !== lastValid) setLastValid(range);
  const applied = range ?? lastValid;
  const error = kind === "personalizado" && !range
    ? custom.from && custom.to
      ? "Revisá las fechas: «Hasta» no puede ser anterior a «Desde» y el período no puede superar un año."
      : "Elegí las dos fechas para ver ese período."
    : null;

  const [period, setPeriod] = useState<PeriodData | null>(null);
  const [side, setSide] = useState<SideData | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [opened, setOpened] = useState<ReceiptLike | null>(null);

  const periodKey = applied ? `${applied.from}|${applied.to}` : "";

  // Lo que depende del período elegido.
  useEffect(() => {
    if (!applied) return;
    let cancelled = false;
    Promise.all([salesSummary(db, applied.from, applied.to), salesByPaymentMethod(db, applied.from, applied.to)])
      .then(([summary, payments]) => {
        if (!cancelled) {
          setPeriod({ key: periodKey, summary, payments });
          setFailure(null);
        }
      })
      .catch((e) => !cancelled && setFailure({ key: periodKey, message: e instanceof Error ? e.message : "No se pudo cargar el dashboard." }));
    return () => {
      cancelled = true;
    };
  }, [db, applied, periodKey]);

  // Lo que no depende del período (se carga una vez).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      manager ? lowStock(db) : Promise.resolve(null),
      listSales(db, { from: null, to: null, method: "" }),
      manager ? listMovements(db, 20).catch(() => null) : Promise.resolve(null),
      salesMonthlyByPaymentMethod(db, 6).catch(() => [] as MonthlyRow[]),
    ])
      .then(([low, sales, movements, monthly]) => !cancelled && setSide({ low, sales, movements, monthly }))
      .catch((e) => !cancelled && setFailure({ key: "side", message: e instanceof Error ? e.message : "No se pudo cargar el dashboard." }));
    return () => {
      cancelled = true;
    };
  }, [db, manager]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of period?.payments.methods ?? []) map[m.code] = m.label;
    return map;
  }, [period]);

  const activity = useMemo<Activity[]>(() => {
    if (!side) return [];
    const sales: Activity[] = side.sales.map((s) => ({
      key: s.id,
      kind: "venta",
      at: s.createdAt,
      title: `Venta #${s.number}${manager ? ` · ${s.userName}` : ""}`,
      amount: s.total,
      units: s.lines.reduce((n, l) => n + l.quantity, 0),
      detail: `${labels[s.paymentMethod] ?? s.paymentMethod}\n${s.lines.map((l) => `${l.quantity} × ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ""}`).join("\n")}`,
    }));
    const stock: Activity[] = (side.movements ?? []).filter((m) => m.reason !== "venta").map((m) => ({
      key: `mov-${m.id}`,
      kind: REASON[m.reason],
      at: m.createdAt,
      title: `${m.productName ?? "Producto eliminado"}${m.variant ? ` (${m.variant})` : ""}`,
      amount: null,
      units: m.delta,
      detail: `Stock: ${m.stockBefore} → ${m.stockAfter}${m.userName ? `\nRegistró: ${m.userName}` : ""}${m.note ? `\nNota: ${m.note}` : ""}`,
    }));
    return [...sales, ...stock];
  }, [side, labels, manager]);

  if (failure && !period && !side) return <Notice tone="warn" title="No se pudo cargar el dashboard">{failure.message}</Notice>;
  if (!applied || !period || !side) return <BrandLoader label="Cargando la actividad…" />;

  const { summary, payments } = period;
  const loading = period.key !== periodKey;
  const mine = manager ? "" : " (tuyas)";
  const ticket = averageTicket(summary.revenue, summary.salesCount);
  const kpis: Kpi[] = [
    { label: `Ventas${mine}`, value: String(summary.salesCount), hint: "Cantidad de ventas confirmadas." },
    { label: `Facturación${mine}`, value: formatPrice(summary.revenue), hint: "Suma del total de esas ventas." },
    { label: `Unidades${mine}`, value: String(summary.units), hint: "Suma de las cantidades vendidas." },
    { label: "Ticket promedio", value: ticket === null ? "—" : formatPrice(ticket), hint: "Facturación dividida por ventas." },
    ...(manager && side.low ? [{ label: "Stock bajo", value: String(side.low.length), hint: `Variantes con ${LOW_STOCK_THRESHOLD} unidades o menos (hoy).` }] : []),
  ];
  const comparison = compareMonths(side.monthly, monthKey(new Date()));
  const saleById = new Map(side.sales.map((s) => [s.id, s]));

  return (
    <div className="space-y-4 sm:space-y-6">
      <PeriodPicker kind={kind} onKind={setKind} custom={custom} onCustom={setCustom} error={error} label={applied.label} />

      <div className={loading ? "opacity-60 motion-safe:transition-opacity" : "motion-safe:transition-opacity"} aria-busy={loading}>
        <KpiGrid kpis={kpis} ariaLabel={`Indicadores: ${applied.label}`} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div className={loading ? "opacity-60" : ""}>
          <PaymentPanel methods={payments.methods} operations={payments.operations} revenue={payments.revenue} period={applied.label} />
        </div>
        <MonthlyPanel rows={side.monthly} labels={labels} comparison={comparison} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Panel title="Más vendidos" subtitle={`Por unidades, ${PERIOD_LABEL[kind] === "Elegir fechas" ? "período elegido" : PERIOD_LABEL[kind].toLowerCase()}`}>
          {summary.topProducts.length === 0 ? (
            <Empty>No se vendió nada en este período.</Empty>
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

        {manager && side.low && (
          <Panel title={`Stock bajo (${LOW_STOCK_THRESHOLD} o menos)`} link={{ href: "/panel/productos", label: "Ver productos" }}>
            {side.low.length === 0 ? (
              <Empty>Ninguna variante está por debajo del umbral.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {side.low.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0">{l.name}{l.variant ? ` (${l.variant})` : ""}</span>
                    <Badge tone={l.stock === 0 ? "danger" : "warn"}>{l.stock === 0 ? "Sin stock" : `${l.stock} u.`}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <ActivityPanel
        items={activity}
        showStock={manager && side.movements !== null}
        onOpenSale={(id) => {
          const sale = saleById.get(id);
          if (sale) setOpened(saleToReceipt(sale, labels[sale.paymentMethod] ?? sale.paymentMethod));
        }}
      />
      <ReceiptDialog receipt={opened} onClose={() => setOpened(null)} />

      <Notice title="Consultas por WhatsApp">
        Todavía no se registran: el botón del catálogo solo abre WhatsApp y no hay una fuente de datos de consultas. Estos indicadores
        cuentan solo ventas registradas en el punto de venta, no consultas, pedidos del catálogo ni cobros acreditados.
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
