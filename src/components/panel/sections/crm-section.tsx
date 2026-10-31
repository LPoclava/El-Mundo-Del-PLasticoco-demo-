"use client";

import { useState } from "react";
import {
  COMMERCIAL_ACTIVITY, CRM_KPIS, SALES_SERIES, type SalesPeriod,
} from "@/lib/panel-demo/data";
import { formatDateTime, formatPrice } from "@/lib/panel-demo/format";
import { CARD_CLASS, DemoBadge, Notice, PageHeader } from "../ui";

/**
 * CRM e informes: DISEÑO con cifras inventadas. Todavía no existe un registro de ventas, por lo
 * que nada de lo que se ve acá es real. Cuando se implemente, estas vistas leerán esos datos.
 */

const W = 640;
const H = 220;
const PAD = { l: 56, r: 28, t: 12, b: 28 };

function niceMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag / 2) * mag * 2;
}

function SalesChart({ period }: { period: SalesPeriod }) {
  const { labels, values, label } = SALES_SERIES[period];
  const max = niceMax(Math.max(...values));
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, values.length - 1);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("es-AR")} M` : `${v / 1000} mil`);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ventas de demostración, ${label.toLowerCase()}`} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-brand-line)" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-brand-muted)">{t === 0 ? "0" : `$ ${compact(t)}`}</text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(0)} ${points} ${x(values.length - 1)},${y(0)}`} fill="var(--color-brand-orange)" opacity="0.14" />
        <polyline points={points} fill="none" stroke="var(--color-brand-orange)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="white" stroke="var(--color-brand-ink)" strokeWidth="1.5" />
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-brand-muted)">{l}</text>
        ))}
      </svg>
      <figcaption className="sr-only">
        {labels.map((l, i) => `${l}: ${formatPrice(values[i])}`).join(". ")}
      </figcaption>
    </figure>
  );
}

export function CrmSection() {
  const [period, setPeriod] = useState<SalesPeriod>("30d");
  const total = SALES_SERIES[period].values.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM e informes"
        subtitle="Resumen comercial para decidir qué reponer, qué promocionar y cómo viene el mes."
        actions={<DemoBadge />}
      />

      <Notice tone="info" title="Los informes definitivos llegarán con el registro de ventas">
        Hoy el sistema todavía no registra ventas. Todo lo que ves acá son cifras inventadas para mostrar cómo se vería; no representan al negocio.
      </Notice>

      <section aria-label="Resumen comercial" className={`${CARD_CLASS} grid grid-cols-2 md:grid-cols-4`}>
        {CRM_KPIS.map((k, i) => (
          <div key={k.label} className={`px-5 py-4 ${i > 1 ? "border-t border-brand-line md:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-brand-line" : ""} ${i > 0 ? "md:border-l md:border-brand-line" : ""}`}>
            <p className="text-sm text-brand-muted">{k.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{k.hint}</p>
          </div>
        ))}
      </section>

      <section className={`${CARD_CLASS} p-5`} aria-labelledby="evolucion-titulo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="evolucion-titulo" className="text-base font-semibold">Evolución de ventas</h2>
            <p className="text-sm text-brand-muted">Total del período: <span className="font-medium tabular-nums text-brand-ink">{formatPrice(total)}</span> <span className="text-xs">(ejemplo)</span></p>
          </div>
          <div className="inline-flex rounded-lg border border-brand-line p-0.5" role="group" aria-label="Período">
            {(Object.keys(SALES_SERIES) as SalesPeriod[]).map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
                className={`h-11 rounded-md px-3 text-sm font-medium ${period === p ? "bg-brand-ink text-white" : "hover:bg-brand-sand"}`}>
                {SALES_SERIES[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4"><SalesChart period={period} /></div>
      </section>

      <div className="grid gap-6">
        <section className={`${CARD_CLASS} p-5`} aria-labelledby="comercial-titulo">
          <div className="flex items-center justify-between gap-2">
            <h2 id="comercial-titulo" className="text-base font-semibold">Actividad comercial reciente</h2>
            <span className="text-xs text-brand-muted">ejemplo</span>
          </div>
          <ul className="mt-4 divide-y divide-brand-line">
            {COMMERCIAL_ACTIVITY.map((a) => (
              <li key={a.at} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm">{a.text}</p>
                <p className="mt-0.5 text-xs tabular-nums text-brand-muted">{formatDateTime(a.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
