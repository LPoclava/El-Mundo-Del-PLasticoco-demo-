"use client";

import { useState } from "react";
import { PosSection } from "../pos/pos-section";
import { PageHeader } from "../ui";
import { PriceLookupSection } from "./price-lookup-section";

type Tab = "vender" | "precios";

const TABS: { id: Tab; label: string }[] = [
  { id: "vender", label: "Vender" },
  { id: "precios", label: "Consultar precios (demostración)" },
];

/**
 * Sección del escáner. «Vender» es el punto de venta conectado a Supabase; «Consultar precios» es
 * la maqueta anterior, con datos en memoria, hasta que se conecte la consulta y corrección de precios.
 */
export function ScannerSection() {
  const [tab, setTab] = useState<Tab>("vender");
  return (
    <div className="space-y-6">
      <PageHeader title="Escáner y ventas" subtitle="Escaneá los productos, armá la venta, elegí el medio de pago y confirmá." />

      <div role="tablist" aria-label="Modo del escáner" className="flex gap-1 border-b border-brand-line">
        {TABS.map((t) => (
          <button
            key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative -mb-px h-11 whitespace-nowrap px-4 text-sm font-medium ${
              tab === t.id ? "text-brand-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand-orange" : "text-brand-muted hover:text-brand-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "vender" ? <PosSection /> : <PriceLookupSection embedded />}
      </div>
    </div>
  );
}
