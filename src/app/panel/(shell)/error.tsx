"use client";

import { Button, LinkButton, Notice } from "@/components/panel/ui";

/** Error inesperado en una pantalla del panel: el menú y la cabecera siguen disponibles. */
export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <Notice tone="warn" title="No pudimos mostrar esta pantalla">
        Puede ser un problema de conexión. Los datos guardados no se pierden.
      </Notice>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon="refresh" onClick={reset}>Reintentar</Button>
        <LinkButton href="/panel">Ir al inicio del panel</LinkButton>
      </div>
    </div>
  );
}
