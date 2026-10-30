"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import { parseQuantity } from "@/lib/pos/cart";
import {
  adjustStock, createDraftProduct, listMainCategories, receiveStock, sellable, variantLabel,
  type CategoryOption, type PosProduct, type PosVariant,
} from "@/lib/pos/api";
import { STOCK_LABEL, checkStockOperation, type AdjustDirection, type StockMode } from "@/lib/pos/stock";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { Badge, Button, INPUT_CLASS, Notice, SelectInput, TextInput } from "../ui";

export type ScanResult =
  | { kind: "loading"; code: string }
  | { kind: "product"; product: PosProduct }
  | { kind: "unknown"; code: string };

type Props = {
  db: SupabaseClient;
  result: ScanResult;
  /** Gerente o superior: puede mover stock y completar productos. */
  canManage: boolean;
  onClose: () => void;
  onAdd: (product: PosProduct, variant: PosVariant, quantity: number) => void;
  /** Vuelve a consultar el producto (después de mover stock). */
  onRefresh: (code: string) => Promise<void>;
  onNotify: (message: string, tone?: "ok" | "error") => void;
};

/** Título del panel superior según el resultado. */
export function resultTitle(result: ScanResult): string {
  if (result.kind === "loading") return "Buscando producto…";
  if (result.kind === "unknown") return `Código ${result.code}`;
  return result.product.name;
}

/**
 * Resultado de un escaneo, siempre visible en la parte de arriba de la pantalla. Tres acciones
 * distintas y de distinto color: CONSULTAR (solo lectura), AGREGAR AL CARRITO (naranja) y
 * ACTUALIZAR STOCK (verde, solo gerentes). Nada se modifica hasta confirmar cada una.
 */
export function ResultPanel(props: Props) {
  const { result } = props;
  if (result.kind === "loading") {
    return <p role="status" className="py-6 text-center text-brand-muted">Buscando el código {result.code}…</p>;
  }
  if (result.kind === "unknown") return <UnknownProduct key={result.code} {...props} code={result.code} />;
  return <FoundProduct key={result.product.productId} {...props} product={result.product} />;
}

function Thumb({ path, name }: { path: string | null; name: string }) {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-sand sm:size-24">
      {path ? (
        <Image src={productImageUrl(path)} alt={name} fill sizes="96px" className="object-cover" />
      ) : (
        <span aria-hidden className="grid size-full place-items-center text-brand-muted"><Icon name="box" className="size-8" /></span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- producto existente

type Mode = "ver" | "stock";

function FoundProduct({ db, product, canManage, onClose, onAdd, onRefresh, onNotify }: Props & { product: PosProduct }) {
  const [mode, setMode] = useState<Mode>("ver");
  const [showDetails, setShowDetails] = useState(false);
  const firstSellable = product.variants.find((v) => sellable(product, v));
  const [variantId, setVariantId] = useState<string | null>((firstSellable ?? product.variants[0])?.id ?? null);
  const [qty, setQty] = useState("1");
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const ok = variant !== null && sellable(product, variant);
  const n = parseQuantity(qty);
  const overStock = variant !== null && n !== null && n > variant.stock;
  const incomplete = product.variants.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Thumb path={product.imagePath} name={product.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm tabular-nums text-brand-muted">
            {[product.brand, product.barcode ? `Código ${product.barcode}` : null].filter(Boolean).join(" · ") || "Sin código"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {product.archived && <Badge tone="danger">Archivado: no se vende</Badge>}
            {incomplete && <Badge tone="warn">Producto incompleto</Badge>}
          </div>
          {!incomplete && (
            <p className="mt-1.5 text-lg font-semibold tabular-nums">
              {rangeLabel(product)}
            </p>
          )}
        </div>
      </div>

      {incomplete ? (
        <div className="space-y-3">
          <Notice tone="warn" title="Todavía no se puede vender">
            Este producto no tiene variantes ni precio cargados, así que no se puede agregar a una venta ni cargarle stock.
          </Notice>
          <CompleteButton productId={product.productId} canManage={canManage} />
        </div>
      ) : mode === "ver" ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{product.variants.length > 1 ? "Elegí la variante" : "Variante"}</legend>
            <ul className="space-y-2">
              {product.variants.map((v) => {
                const label = variantLabel(v) ?? "Única";
                const selected = v.id === variantId;
                return (
                  <li key={v.id}>
                    <label
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink ${
                        selected ? "border-brand-ink bg-brand-sand" : "border-brand-line bg-white hover:border-brand-ink"
                      }`}
                    >
                      <input type="radio" name="variante" value={v.id} checked={selected} onChange={() => setVariantId(v.id)} className="size-5 accent-brand-green" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-brand-muted tabular-nums">
                          {v.price !== null && v.price > 0 ? formatPrice(v.price) : "Sin precio"} · {v.stock > 0 ? `Stock: ${v.stock}` : "Sin stock"}
                        </span>
                      </span>
                      {!sellable(product, v) && <Badge tone="warn">{v.price === null || v.price <= 0 ? "Sin precio" : "Sin stock"}</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {showDetails && <Details product={product} />}

          {/* Tres acciones distintas: consultar, vender y mover stock. */}
          <div className="space-y-3 border-t border-brand-line pt-4">
            <Button variant="ghost" icon="info" className="w-full justify-start border border-brand-line" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? "Ocultar la ficha" : "Consultar producto"}
              <span className="ml-auto hidden text-xs font-normal text-brand-muted sm:inline">solo mirar, no cambia nada</span>
            </Button>

            <div className="rounded-xl border-2 border-brand-orange/60 bg-brand-orange/10 p-3">
              <p className="text-sm font-semibold">Venta</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label htmlFor="res-qty" className="text-sm">Cantidad</label>
                <input
                  id="res-qty" inputMode="numeric" value={qty} aria-invalid={n === null || overStock}
                  onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setQty(e.target.value)}
                  className={`${INPUT_CLASS} h-12 w-20 px-1 text-center tabular-nums`}
                />
                <Button
                  variant="primary" icon="plus" className="h-12 min-w-44 flex-1 text-base"
                  disabled={!ok || n === null || overStock}
                  onClick={() => variant && n !== null && onAdd(product, variant, n)}
                >
                  Agregar al carrito
                </Button>
              </div>
              {overStock && variant && <p role="alert" className="mt-1.5 text-sm text-brand-danger">Solo hay {variant.stock} en stock.</p>}
              {!ok && variant && <p className="mt-1.5 text-sm text-brand-muted">Esta variante no se puede vender: {product.archived ? "el producto está archivado" : variant.price === null || variant.price <= 0 ? "no tiene precio" : "no tiene stock"}.</p>}
            </div>

            <div className="rounded-xl border-2 border-brand-green/50 bg-brand-green/10 p-3">
              <p className="text-sm font-semibold">Inventario</p>
              <Button
                className="mt-2 h-12 w-full border-brand-green/60 text-base text-brand-green-ink" icon="refresh"
                disabled={!canManage || variant === null || product.archived} aria-disabled={!canManage}
                onClick={() => setMode("stock")}
              >
                Actualizar stock
              </Button>
              {!canManage && <p className="mt-1.5 text-sm text-brand-muted">Solo un gerente o el CEO puede cargar o ajustar stock.</p>}
            </div>
          </div>
        </>
      ) : (
        variant && (
          <StockForm
            db={db} product={product} variant={variant} onBack={() => setMode("ver")}
            onDone={async (message) => {
              onNotify(message);
              await onRefresh(product.barcode ?? product.name);
              setMode("ver");
            }}
          />
        )
      )}

      <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar y seguir escaneando</Button>
    </div>
  );
}

function rangeLabel(p: PosProduct): string {
  const prices = p.variants.map((v) => v.price).filter((x): x is number => x !== null && x > 0);
  if (prices.length === 0) return "Sin precio";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} a ${formatPrice(max)}`;
}

function Details({ product }: { product: PosProduct }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-brand-line bg-white p-3 text-sm">
      <dt className="text-brand-muted">Nombre</dt><dd>{product.name}</dd>
      {product.brand && (<><dt className="text-brand-muted">Marca</dt><dd>{product.brand}</dd></>)}
      <dt className="text-brand-muted">Código</dt><dd className="tabular-nums">{product.barcode ?? "Sin código"}</dd>
      <dt className="text-brand-muted">Descripción</dt><dd>{product.description ?? "Sin descripción cargada."}</dd>
      <dt className="text-brand-muted">Stock</dt>
      <dd>
        <ul className="space-y-0.5 tabular-nums">
          {product.variants.map((v) => <li key={v.id}>{variantLabel(v) ?? "Única"}: {v.stock}</li>)}
        </ul>
      </dd>
    </dl>
  );
}

function CompleteButton({ productId, canManage }: { productId: string; canManage: boolean }) {
  if (!canManage) {
    return <p className="text-sm text-brand-muted">Un gerente tiene que completarlo en la sección Productos (fotos, precio y variantes).</p>;
  }
  return (
    <Link
      href={`/panel/productos/${productId}`}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-orange text-base font-medium text-brand-ink hover:bg-brand-orange/85"
    >
      <Icon name="edit" className="size-4" />Completar producto
    </Link>
  );
}

// ---------------------------------------------------------------- entrada y ajuste de stock

function StockForm({ db, product, variant, onBack, onDone }: {
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

// ---------------------------------------------------------------- código sin producto

function UnknownProduct({ db, code, canManage, onClose, onNotify }: Props & { code: string }) {
  const [mode, setMode] = useState<"aviso" | "registro" | "registrado">("aviso");
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (mode === "registrado" && createdId) {
    return (
      <div className="space-y-4">
        <Notice title="Producto registrado, sin publicar">
          Quedó creado con el código {code}. Todavía no tiene precio, variantes ni fotos: no se puede vender, no aparece en el catálogo y no admite movimientos de stock.
        </Notice>
        <CompleteButton productId={createdId} canManage={canManage} />
        <Button variant="ghost" className="w-full" onClick={onClose}>Seguir escaneando</Button>
      </div>
    );
  }
  if (mode === "registro") {
    return (
      <QuickRegister
        db={db} code={code} onBack={() => setMode("aviso")}
        onCreated={(id) => {
          setCreatedId(id);
          setMode("registrado");
          onNotify("Producto registrado sin publicar.");
        }}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-brand-danger/30 bg-brand-danger/5 p-4">
        <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-brand-danger" />
        <div>
          <p className="font-semibold">Producto no registrado</p>
          <p className="mt-0.5 text-sm text-brand-muted">No hay ningún producto con el código <strong className="tabular-nums text-brand-ink">{code}</strong>. No se agregó nada al carrito.</p>
        </div>
      </div>
      <Button variant="primary" icon="plus" className="h-12 w-full text-base" onClick={() => setMode("registro")}>Registrar producto</Button>
      <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar y seguir escaneando</Button>
    </div>
  );
}

function QuickRegister({ db, code, onBack, onCreated }: { db: SupabaseClient; code: string; onBack: () => void; onCreated: (id: string) => void }) {
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listMainCategories(db)
      .then((c) => {
        if (cancelled) return;
        setCategories(c);
        setCategoryId((id) => id || c[0]?.id || "");
      })
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [db]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    if (!name.trim()) return setError("Escribí el nombre del producto.");
    if (!categoryId) return setError("Elegí una categoría principal.");
    if (description.length > 2000) return setError("La descripción es demasiado larga.");
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      onCreated(await createDraftProduct(db, { barcode: code, name: name.trim(), categoryId, description }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el producto.");
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <p className="font-semibold">Registrar producto</p>
        <p className="text-sm text-brand-muted">Quedará sin publicar. El precio, las variantes y las fotos se cargan después en Productos.</p>
      </div>
      <TextInput label="Código de barras (detectado)" value={code} readOnly/>
      <TextInput label="Nombre del producto" value={name} maxLength={200} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }} />
      <SelectInput label="Categoría principal" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categories === null}>
        {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectInput>
      <TextInput label="Descripción breve (opcional)" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      {error && <p role="alert" className="text-sm text-brand-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>Volver</Button>
        <Button type="submit" variant="primary" className="h-12 min-w-44" disabled={busy}>{busy ? "Registrando…" : "Registrar producto"}</Button>
      </div>
    </form>
  );
}
