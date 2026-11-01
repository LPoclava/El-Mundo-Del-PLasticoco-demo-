"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLoader } from "@/components/brand-loader";
import { formatPrice } from "@/lib/catalog/url";
import { findProducts, isBarcode, variantLabel, type PosProduct } from "@/lib/pos/api";
import { listMovements, type MovementRow2 } from "@/lib/pos/dashboard";
import { BarcodeScanner } from "../barcode-scanner";
import { Icon } from "../icons";
import { PosGate } from "../pos/pos-gate";
import { StockForm } from "../pos/stock-form";
import { useToasts } from "../use-toasts";
import { Badge, Button, CARD_CLASS, EmptyState, INPUT_CLASS, LinkButton, Notice, PageHeader, Toaster } from "../ui";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const REASON: Record<MovementRow2["reason"], string> = { venta: "Venta", entrada: "Ingreso", ajuste: "Ajuste", inicial: "Stock inicial" };

/**
 * Control de stock: ingreso de mercadería y ajustes. Va aparte de las ventas a propósito. El producto se
 * identifica escaneando su código (con lector o cámara); si el código no existe no se toca nada. La base valida
 * cada operación (permiso, motivo del ajuste, stock nunca negativo) y deja un movimiento que acá solo se lee.
 */
export function StockSection() {
  return (
    <div className="space-y-5">
      <PageHeader title="Control de stock" subtitle="Ingreso de mercadería y ajustes de inventario." />
      <PosGate>
        {({ db, role }) =>
          role === "empleado" ? (
            <Notice tone="warn" title="Esta cuenta no está habilitada para mover stock">Solicitá acceso a un responsable.</Notice>
          ) : (
            <Workspace db={db} />
          )
        }
      </PosGate>
    </div>
  );
}

type Found = { kind: "none" } | { kind: "loading"; code: string } | { kind: "unknown"; code: string } | { kind: "product"; product: PosProduct };

function Workspace({ db }: { db: SupabaseClient }) {
  const { toasts, push } = useToasts();
  const [found, setFound] = useState<Found>({ kind: "none" });
  const [variantId, setVariantId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [version, setVersion] = useState(0);
  const manualRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const lookup = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!isBarcode(value)) {
      push("Ese no parece un código de barras. Escaneá el producto o escribí los dígitos del código.", "error");
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setFound({ kind: "loading", code: value });
    try {
      const products = await findProducts(db, value);
      const exact = products.find((p) => p.barcode === value);
      if (exact) {
        setFound({ kind: "product", product: exact });
        setVariantId((exact.variants[0] ?? null)?.id ?? null);
      } else {
        setFound({ kind: "unknown", code: value });
      }
    } catch (e) {
      setFound({ kind: "none" });
      push(e instanceof Error ? e.message : "No se pudo buscar el producto.", "error");
    } finally {
      busy.current = false;
    }
  }, [db, push]);

  function onManual(e: FormEvent) {
    e.preventDefault();
    void lookup(code);
  }

  const product = found.kind === "product" ? found.product : null;
  const variant = product?.variants.find((v) => v.id === variantId) ?? null;

  return (
    <>
      <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-label="Identificar producto">
        <BarcodeScanner
          startLabel="Escanear producto"
          onDetect={(c) => void lookup(c)}
          onManual={() => requestAnimationFrame(() => manualRef.current?.focus())}
        />
        <form onSubmit={onManual} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="stock-code" className="mb-1.5 block text-sm font-medium">¿Lector o sin cámara? Escribí el código de barras</label>
            <input
              id="stock-code" ref={manualRef} inputMode="numeric" autoComplete="off" value={code} maxLength={14}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={INPUT_CLASS} placeholder="Solo dígitos"
            />
          </div>
          <Button type="submit" icon="search" disabled={code.length < 8}>Buscar</Button>
        </form>
      </section>

      {found.kind === "loading" && <p role="status" className="text-sm text-brand-muted">Buscando el código {found.code}…</p>}

      {found.kind === "unknown" && (
        <Notice
          tone="warn"
          title={`El código ${found.code} no está registrado`}
          action={<LinkButton href="/panel/productos/nuevo" variant="primary" size="sm" icon="plus">Registrar en Productos</LinkButton>}
        >
          No se modificó ningún stock. Primero hay que cargar el producto.
        </Notice>
      )}

      {product && (
        <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-labelledby="stock-producto">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="stock-producto" className="text-lg font-semibold">{product.name}</h2>
              <p className="text-sm tabular-nums text-brand-muted">{[product.brand, product.barcode ? `Código ${product.barcode}` : null].filter(Boolean).join(" · ")}</p>
            </div>
            {product.archived && <Badge tone="danger">Archivado</Badge>}
          </div>

          {product.variants.length === 0 ? (
            <div className="mt-3">
              <Notice tone="warn" title="Este producto todavía no tiene variantes">Completalo en Productos antes de cargarle stock.</Notice>
            </div>
          ) : (
            <>
              <fieldset className="mt-4">
                <legend className="mb-2 text-sm font-medium">{product.variants.length > 1 ? "Elegí la variante" : "Variante"}</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {product.variants.map((v) => (
                    <li key={v.id}>
                      <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink ${v.id === variantId ? "border-brand-green bg-brand-green/10" : "border-brand-line bg-white hover:border-brand-ink"}`}>
                        <input type="radio" name="stock-variante" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="size-5 accent-brand-green" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{variantLabel(v) ?? "Única"}</span>
                          <span className="block text-xs tabular-nums text-brand-muted">{v.price ? formatPrice(v.price) : "Sin precio"} · Stock {v.stock}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              {variant && !product.archived && (
                <div className="mt-4 max-w-xl">
                  <StockForm
                    key={variant.id}
                    db={db}
                    product={product}
                    variant={variant}
                    onBack={() => setFound({ kind: "none" })}
                    onDone={async (message) => {
                      push(message);
                      setVersion((n) => n + 1);
                      // Se vuelve a leer el producto para mostrar el stock actualizado.
                      if (product.barcode) {
                        const fresh = (await findProducts(db, product.barcode)).find((p) => p.barcode === product.barcode);
                        if (fresh) setFound({ kind: "product", product: fresh });
                      }
                    }}
                  />
                </div>
              )}
              {product.archived && <p className="mt-3 text-sm text-brand-muted">Un producto archivado no admite movimientos de stock.</p>}
            </>
          )}
        </section>
      )}

      <History db={db} version={version} />
      <Toaster toasts={toasts} />
    </>
  );
}

function History({ db, version }: { db: SupabaseClient; version: number }) {
  const [rows, setRows] = useState<MovementRow2[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMovements(db, 30)
      .then((r) => { if (!cancelled) { setRows(r); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo leer el historial."); });
    return () => {
      cancelled = true;
    };
  }, [db, version, attempt]);

  return (
    <section className={CARD_CLASS} aria-labelledby="historial-stock">
      <div className="flex items-center gap-2 border-b border-brand-line px-4 py-3">
        <Icon name="history" className="size-5 text-brand-muted" />
        <h2 id="historial-stock" className="text-base font-semibold">Historial de movimientos</h2>
        <span className="text-xs text-brand-muted">Solo lectura</span>
      </div>
      {error ? (
        <div className="space-y-3 p-4">
          <Notice tone="warn" title="No se pudo leer el historial">{error}</Notice>
          <Button icon="refresh" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Reintentar</Button>
        </div>
      ) : rows === null ? (
        <BrandLoader label="Cargando movimientos…" />
      ) : rows.length === 0 ? (
        <EmptyState title="Todavía no hay movimientos">Cada ingreso, ajuste o venta de stock va a quedar registrado acá.</EmptyState>
      ) : (
        <ul className="divide-y divide-brand-line">
          {rows.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="min-w-0 font-medium">{m.productName ?? "Producto eliminado"}{m.variant ? ` · ${m.variant}` : ""}</p>
                <p className="text-xs tabular-nums text-brand-muted">{dateTime.format(new Date(m.createdAt))}</p>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                <Badge tone={m.reason === "venta" ? "muted" : m.reason === "ajuste" ? "warn" : "ok"}>{REASON[m.reason] ?? m.reason}</Badge>
                <span className={m.delta > 0 ? "font-semibold text-brand-green-ink" : "font-semibold text-brand-danger"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                <span className="text-brand-muted">stock {m.stockBefore} → {m.stockAfter}</span>
                {m.userName && <span className="text-brand-muted">· {m.userName}</span>}
              </p>
              {m.note && <p className="mt-0.5 text-brand-muted">{m.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
