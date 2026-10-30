"use client";

import Image from "next/image";
import { useState } from "react";
import { parseQuantity } from "@/lib/pos/cart";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { Button, INPUT_CLASS } from "../ui";

export function Thumb({ path }: { path: string | null }) {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-brand-sand">
      {path ? (
        <Image src={productImageUrl(path)} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span aria-hidden className="grid size-full place-items-center text-brand-muted"><Icon name="box" className="size-5" /></span>
      )}
    </div>
  );
}

/** Cantidad con − / + y campo editable (solo enteros de 1 al stock). */
export function QuantityStepper({ name, value, max, onChange, onStep }: {
  name: string; value: number; max: number; onChange: (n: number) => void; onStep: (d: 1 | -1) => void;
}) {
  // El campo guarda lo escrito: se valida al salir y mientras tanto no deja entrar valores inválidos.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const invalidDraft = draft !== null && parseQuantity(draft) === null;
  return (
    <div role="group" aria-label={`Cantidad de ${name}`}>
      <div className="flex items-center gap-1">
        <Button size="sm" className="size-11 px-0" onClick={() => onStep(-1)} disabled={value <= 1} aria-label={`Una unidad menos de ${name}`}>−</Button>
        <input
          inputMode="numeric" value={shown} aria-label={`Cantidad de ${name}`} aria-invalid={value > max || invalidDraft}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || /^\d{0,4}$/.test(raw)) {
              setDraft(raw);
              const n = parseQuantity(raw);
              if (n !== null) onChange(n);
            }
          }}
          onBlur={() => setDraft(null)}
          className={`${INPUT_CLASS} h-11 w-14 px-1 text-center tabular-nums`}
        />
        <Button size="sm" className="size-11 px-0" onClick={() => onStep(1)} disabled={value >= max} aria-label={`Una unidad más de ${name}`}>+</Button>
        <span className="ml-1 hidden text-xs text-brand-muted min-[400px]:inline">de {max}</span>
      </div>
      {invalidDraft && <p role="alert" className="mt-1 text-xs text-brand-danger">Escribí un número entero de 1 en adelante.</p>}
    </div>
  );
}
