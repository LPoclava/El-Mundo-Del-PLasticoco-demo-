"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustStock, receiveStock, variantLabel, type PosProduct, type PosVariant } from "@/lib/pos/api";
import { STOCK_LABEL, checkStockOperation, type AdjustDirection, type StockMode } from "@/lib/pos/stock";
import { Button, TextInput } from "../ui";

/**
 * Ingreso de mercadería o ajuste de un producto ya identificado. La base valida de nuevo (receive_stock y
 * adjust_stock): el ajuste exige motivo y nunca deja stock negativo; cada movimiento queda registrado.
 */
export function StockForm({ db, product, variant, onBack, onDone }: {
  db: SupabaseClient; product: PosProduct; variant: PosVariant; onBack: () => void; onDone: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<StockMode>("entrada");
  const [direction, setDirection] = useState<AdjustDirection>("sumar");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const check = checkStockOperation({ mode, direction, quantity, note, current: variant.stock });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    if (!check.ok) {
      setError(check.error);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const resulting = mode === "entrada"
        ? await receiveStock(db, variant.id, check.delta, note)
        : await adjustStock(db, variant.id, check.delta, note);
      await onDone(mode === "entrada"
        ? `Entrada registrada: +${check.delta}. Stock ahora: ${resulting}.`
        : `Ajuste registrado (${check.delta > 0 ? "+" : ""}${check.delta}). Stock ahora: ${resulting}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.");
      sending.current = false;
      setBusy(false);
    }
  }

  const label = variantLabel(variant) ?? "Única";
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border-2 border-brand-green/50 bg-brand-green/5 p-4">
      <div>
        <p className="font-semibold">Actualizar stock</p>
        <p className="text-sm text-brand-muted">{product.name} · {label} · Stock actual: <strong className="text-brand-ink tabular-nums">{variant.stock}</strong></p>
      </div>

      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
        {(["entrada", "ajuste"] as StockMode[]).map((m) => (
          <label key={m} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink ${mode === m ? "border-brand-green bg-brand-green text-white" : "border-brand-line bg-white"}`}>
            <input type="radio" name="tipo" value={m} checked={mode === m} onChange={() => { setMode(m); setError(null); }} className="sr-only" />
            {STOCK_LABEL[m]}
          </label>
        ))}
      </div>

      {mode === "ajuste" && (
        <div role="radiogroup" aria-label="Sumar o restar" className="grid grid-cols-2 gap-2">
          {(["sumar", "restar"] as AdjustDirection[]).map((d) => (
            <label key={d} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink ${direction === d ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white"}`}>
              <input type="radio" name="sentido" value={d} checked={direction === d} onChange={() => { setDirection(d); setError(null); }} className="sr-only" />
              {d === "sumar" ? "Sumar unidades" : "Restar unidades"}
            </label>
          ))}
        </div>
      )}

      <TextInput
        label={mode === "entrada" ? "Unidades recibidas" : "Unidades a ajustar"} inputMode="numeric" value={quantity}
        onChange={(e) => { if (/^\d{0,7}$/.test(e.target.value)) { setQuantity(e.target.value); setError(null); } }}
        hint={check.ok ? `El stock pasará de ${variant.stock} a ${check.resulting}.` : undefined}
      />
      <TextInput
        label={mode === "entrada" ? "Nota (opcional)" : "Motivo del ajuste"} value={note} maxLength={200}
        placeholder={mode === "entrada" ? "Ej.: remito 0012" : "Ej.: rotura, conteo, devolución al proveedor"}
        onChange={(e) => { setNote(e.target.value); setError(null); }}
      />
      {error && <p role="alert" className="text-sm text-brand-danger">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>Volver</Button>
        <Button type="submit" variant="primary" className="h-12 min-w-44" disabled={busy}>
          {busy ? "Guardando…" : mode === "entrada" ? "Confirmar entrada" : "Confirmar ajuste"}
        </Button>
      </div>
    </form>
  );
}
