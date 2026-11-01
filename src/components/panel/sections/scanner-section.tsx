"use client";

import { PosSection } from "../pos/pos-section";
import { PageHeader } from "../ui";

/** Sección del escáner: consulta, alta rápida, venta y stock en una sola pantalla (prueba piloto). */
export function ScannerSection() {
  return (
    <div className="space-y-6">
      <PageHeader title="Escáner y ventas" subtitle="Consulta de productos y registro de operaciones." />
      <PosSection />
    </div>
  );
}
