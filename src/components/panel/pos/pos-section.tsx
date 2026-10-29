"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import {
  addToCart, applyProblems, attemptSignature, cartIssues, cartTotal, cartUnits, changeQuantity, describeProblem,
  lineSubtotal, parseQuantity, removeLine, setQuantity, type Cart, type SaleProblem,
} from "@/lib/pos/cart";
import {
  confirmSale, createScannedProduct, findProducts, isBarcode, listCategories, listPaymentMethods, sellable, toCartLine,
  variantLabel, type CategoryOption, type PaymentMethod, type PosProduct, type PosVariant, type Receipt, type SaleFailure,
} from "@/lib/pos/api";
import { productImageUrl } from "@/lib/supabase/public";
import { BarcodeScanner } from "../barcode-scanner";
import { Icon } from "../icons";
import { Badge, Button, CARD_CLASS, Dialog, INPUT_CLASS, Notice, SelectInput, TextInput, Toaster, type Toast } from "../ui";
import { PosGate } from "./pos-gate";
import { RecentSales } from "./pos-recent-sales";

/**
 * Punto de venta: escáner + búsqueda a la izquierda, carrito y confirmación a la derecha.
 * Lo que ve esta pantalla es una comodidad; la venta real la valida y registra confirm_sale() en
 * PostgreSQL (permisos, precios, stock, total, idempotencia). El carrito se vacía solo cuando el
 * servidor confirma.
 */
export function PosSection() {
  return <PosGate>{({ db, role }) => <Pos db={db} canSeeAll={role !== "empleado"} />}</PosGate>;
}

type Lookup =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; term: string; products: PosProduct[] }
  | { kind: "unknown"; code: string }
  | { kind: "error"; message: string };

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 2500);
  }, []);
  return { toasts, push };
}

function Pos({ db, canSeeAll }: { db: SupabaseClient; canSeeAll: boolean }) {
  const [cart, setCart] = useState<Cart>([]);
  const cartRef = useRef<Cart>([]);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ failure: SaleFailure; messages: string[] } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [clearing, setClearing] = useState(false);
  const [salesVersion, setSalesVersion] = useState(0);
  const sendingRef = useRef(false);
  const attemptRef = useRef<{ sig: string; key: string } | null>(null);
  const cartPanelRef = useRef<HTMLElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const { toasts, push } = useToasts();

  useEffect(() => {
    let cancelled = false;
    listPaymentMethods(db)
      .then((m) => !cancelled && setMethods(m))
      .catch(() => !cancelled && setMethods([]));
    return () => {
      cancelled = true;
    };
  }, [db]);

  const updateCart = (next: Cart) => {
    cartRef.current = next;
    setCart(next);
  };

  /** Suma al carrito (sin duplicar líneas) y avisa. Usa la referencia para que lecturas seguidas no se pisen. */
  function add(product: PosProduct, variant: PosVariant, quantity = 1) {
    const r = addToCart(cartRef.current, toCartLine(product, variant), quantity);
    updateCart(r.cart);
    if (r.added) {
      setReceipt(null);
      push(`Agregado: ${product.name}${variantLabel(variant) ? ` (${variantLabel(variant)})` : ""}`);
    } else if (r.reason === "no-stock") push(`«${product.name}» no tiene stock.`, "error");
    else push(`No hay más stock de «${product.name}».`, "error");
  }

  async function search(raw: string, fromCamera: boolean) {
    const value = raw.trim();
    if (value.length < 2) return;
    if (!fromCamera) setLookup({ kind: "loading" });
    try {
      const products = await findProducts(db, value);
      if (isBarcode(value)) {
        const exact = products.find((p) => p.barcode === value);
        if (!exact) return setLookup({ kind: "unknown", code: value });
        const options = exact.variants.filter((v) => sellable(exact, v));
        // Producto con una sola variante vendible: va directo al carrito. Con varias, se elige cuál.
        if (options.length === 1 && exact.variants.length === 1) add(exact, options[0]);
        else if (options.length === 0) push(`«${exact.name}» no se puede vender: ${reasonNotSellable(exact)}`, "error");
        setLookup({ kind: "results", term: value, products: [exact] });
      } else {
        setLookup({ kind: "results", term: value, products });
      }
    } catch (e) {
      setLookup({ kind: "error", message: e instanceof Error ? e.message : "No se pudo buscar." });
    }
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    void search(term, false);
  }

  const issues = cartIssues(cart);
  const total = cartTotal(cart);
  const canConfirm = cart.length > 0 && issues.length === 0 && method !== null && !busy;

  async function confirm() {
    // Doble clic o toque repetido: mientras haya un envío en curso no se manda otro.
    if (sendingRef.current || !canConfirm || method === null) return;
    sendingRef.current = true;
    setBusy(true);
    setFailure(null);
    // Una clave por intento: se reutiliza si es el mismo carrito (reintento tras un corte de red) y
    // cambia en cuanto se edita algo.
    const sig = attemptSignature(cartRef.current, method);
    if (attemptRef.current?.sig !== sig) attemptRef.current = { sig, key: crypto.randomUUID() };
    const result = await confirmSale(db, attemptRef.current.key, method, cartRef.current);
    sendingRef.current = false;
    setBusy(false);

    if ("receipt" in result) {
      // Recién ahora, con la confirmación real del servidor, se limpia el carrito.
      updateCart([]);
      setMethod(null);
      attemptRef.current = null;
      setReceipt(result.receipt);
      setSalesVersion((v) => v + 1);
      push(result.receipt.replayed ? `La venta #${result.receipt.number} ya estaba registrada.` : `Venta #${result.receipt.number} registrada.`);
      return;
    }
    const { failure: f } = result;
    if (f.kind === "rejected") updateCart(applyProblems(cartRef.current, f.problems as SaleProblem[]));
    setFailure({ failure: f, messages: f.problems.map(describeProblem) });
    if (f.kind === "rejected") attemptRef.current = null;
  }

  function goToCart() {
    cartPanelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className={`space-y-6 ${cart.length > 0 ? "pb-24 xl:pb-0" : ""}`}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:items-start">
        {/* ---- Escáner y búsqueda ---- */}
        <div className="space-y-5">
          <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-label="Escanear producto">
            <BarcodeScanner
              continuous
              startLabel="Escanear producto"
              onDetect={(code) => void search(code, true)}
              onManual={() => requestAnimationFrame(() => manualRef.current?.focus())}
            />
          </section>

          <section className="rounded-xl border border-brand-line bg-white/60 p-4" aria-label="Buscar producto">
            <form onSubmit={onManualSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="pos-search" className="mb-1.5 block text-sm font-medium">Buscar por nombre o código</label>
                <div className="relative">
                  <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-muted" />
                  <input
                    id="pos-search" ref={manualRef} type="search" autoComplete="off" value={term} maxLength={80}
                    placeholder="Ej.: balde, o el código de barras"
                    onChange={(e) => setTerm(e.target.value)} className={`${INPUT_CLASS} pl-9`}
                  />
                </div>
              </div>
              <Button type="submit" icon="search" disabled={term.trim().length < 2 || lookup.kind === "loading"}>Buscar</Button>
            </form>
          </section>

          <div aria-live="polite" className="scroll-mt-20">
            {lookup.kind === "loading" && <p role="status" className="text-sm text-brand-muted">Buscando…</p>}
            {lookup.kind === "error" && <Notice tone="warn" title="No se pudo buscar">{lookup.message}</Notice>}
            {lookup.kind === "unknown" && <UnknownCode key={lookup.code} db={db} code={lookup.code} onDone={(m) => push(m)} />}
            {lookup.kind === "results" && (
              lookup.products.length === 0 ? (
                <Notice title="Sin resultados">No encontramos productos para «{lookup.term}». Probá con otra palabra o con el código de barras.</Notice>
              ) : (
                <ul className="space-y-3">
                  {lookup.products.map((p) => (
                    <li key={p.productId}><ProductResult product={p} onAdd={add} /></li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>

        {/* ---- Carrito ---- */}
        <section ref={cartPanelRef} className={`${CARD_CLASS} scroll-mt-20 p-4 sm:p-5 xl:sticky xl:top-4`} aria-labelledby="carrito-titulo">
          <div className="flex items-center justify-between gap-2">
            <h2 id="carrito-titulo" className="text-lg font-semibold">Carrito</h2>
            {cart.length > 0 && <Button size="sm" variant="ghost" onClick={() => setClearing(true)}>Vaciar</Button>}
          </div>

          {receipt && cart.length === 0 && <ReceiptCard receipt={receipt} onNew={() => setReceipt(null)} />}

          {cart.length === 0 && !receipt && (
            <p className="mt-3 rounded-lg border border-dashed border-brand-line px-4 py-8 text-center text-sm text-brand-muted">
              Todavía no hay productos. Escaneá un código o buscalo por nombre.
            </p>
          )}

          {cart.length > 0 && (
            <>
              <ul className="mt-3 divide-y divide-brand-line">
                {cart.map((line) => {
                  const issue = issues.find((i) => i.variantId === line.variantId);
                  return (
                    <li key={line.variantId} className="py-3">
                      <div className="flex items-start gap-3">
                        <Thumb path={line.imagePath} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{line.name}</p>
                          <p className="text-xs text-brand-muted">
                            {[line.variantLabel, line.barcode].filter(Boolean).join(" · ") || "Sin código"}
                          </p>
                          <p className="text-xs tabular-nums text-brand-muted">{formatPrice(line.unitPrice)} c/u</p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">{formatPrice(lineSubtotal(line))}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper
                          name={line.name}
                          value={line.quantity}
                          max={line.stock}
                          onChange={(n) => updateCart(setQuantity(cartRef.current, line.variantId, n))}
                          onStep={(d) => updateCart(changeQuantity(cartRef.current, line.variantId, d))}
                        />
                        <Button size="sm" variant="ghost" icon="trash" onClick={() => updateCart(removeLine(cartRef.current, line.variantId))} aria-label={`Quitar ${line.name}`}>
                          Quitar
                        </Button>
                      </div>
                      {issue && (
                        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-brand-danger">
                          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />{issue.message}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              <fieldset className="mt-4">
                <legend className="mb-2 text-sm font-medium">Medio de pago</legend>
                {methods === null ? (
                  <p className="text-sm text-brand-muted">Cargando medios de pago…</p>
                ) : methods.length === 0 ? (
                  <p className="text-sm text-brand-danger">No hay medios de pago habilitados. Avisá a un responsable.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => (
                      <label
                        key={m.code}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink ${
                          method === m.code ? "border-brand-ink bg-brand-sand" : "border-brand-line bg-white hover:border-brand-ink"
                        }`}
                      >
                        <input
                          type="radio" name="pos-method" value={m.code} checked={method === m.code} disabled={busy}
                          onChange={() => setMethod(m.code)} className="size-4 accent-brand-green"
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <div className="mt-4 flex items-baseline justify-between border-t border-brand-line pt-4">
                <p className="text-sm text-brand-muted">{cartUnits(cart)} {cartUnits(cart) === 1 ? "unidad" : "unidades"}</p>
                <p className="text-2xl font-semibold tabular-nums" aria-live="polite">Total {formatPrice(total)}</p>
              </div>

              {failure && (
                <div role="alert" className="mt-3 rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm">
                  <p className="font-medium text-brand-danger">{failure.failure.message}</p>
                  {failure.messages.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-brand-ink">
                      {failure.messages.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <Button
                variant="primary" className="mt-4 h-14 w-full text-base" disabled={!canConfirm} aria-disabled={!canConfirm}
                onClick={() => void confirm()}
              >
                {busy ? "Registrando la venta…" : "Confirmar venta"}
              </Button>
              {!busy && method === null && <p className="mt-2 text-center text-xs text-brand-muted">Elegí un medio de pago para confirmar.</p>}
            </>
          )}
        </section>
      </div>

      <RecentSales db={db} methods={methods ?? []} version={salesVersion} showAll={canSeeAll} />

      {/* Celular: resumen fijo abajo para no perder de vista el total mientras se escanea. */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="tabular-nums">
              <span className="text-sm text-brand-muted">{cartUnits(cart)} u. · </span>
              <span className="text-lg font-semibold">{formatPrice(total)}</span>
            </p>
            <Button variant="primary" className="h-12" onClick={goToCart}>Ver carrito y cobrar</Button>
          </div>
        </div>
      )}

      <Dialog open={clearing} onClose={() => setClearing(false)} title="Vaciar el carrito">
        <p className="text-sm text-brand-muted">Se van a quitar los {cart.length} productos del carrito. No se descuenta stock ni se registra nada.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setClearing(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { updateCart([]); setMethod(null); attemptRef.current = null; setFailure(null); setClearing(false); }}>Vaciar</Button>
        </div>
      </Dialog>

      <Toaster toasts={toasts} />
    </div>
  );
}

function reasonNotSellable(p: PosProduct): string {
  if (p.archived) return "está archivado.";
  if (p.variants.length === 0) return "no tiene variantes cargadas.";
  if (p.variants.every((v) => v.price === null || v.price <= 0)) return "no tiene un precio válido.";
  return "no tiene stock.";
}

function Thumb({ path }: { path: string | null }) {
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

function QuantityStepper({ name, value, max, onChange, onStep }: {
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

function ProductResult({ product, onAdd }: { product: PosProduct; onAdd: (p: PosProduct, v: PosVariant, qty: number) => void }) {
  return (
    <article className={`${CARD_CLASS} p-4`}>
      <div className="flex items-start gap-3">
        <Thumb path={product.imagePath} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{product.name}</h3>
          <p className="text-xs text-brand-muted tabular-nums">{[product.brand, product.barcode].filter(Boolean).join(" · ") || "Sin código"}</p>
          {product.archived && <div className="mt-1"><Badge tone="danger">Archivado: no se vende</Badge></div>}
        </div>
      </div>
      {product.variants.length === 0 ? (
        <p className="mt-3 text-sm text-brand-muted">Este producto todavía no tiene variantes ni precio cargados.</p>
      ) : (
        <ul className="mt-3 divide-y divide-brand-line">
          {product.variants.map((v) => <VariantRow key={v.id} product={product} variant={v} onAdd={onAdd} />)}
        </ul>
      )}
    </article>
  );
}

function VariantRow({ product, variant, onAdd }: { product: PosProduct; variant: PosVariant; onAdd: (p: PosProduct, v: PosVariant, qty: number) => void }) {
  const [qty, setQty] = useState("1");
  const ok = sellable(product, variant);
  const n = parseQuantity(qty);
  const overStock = n !== null && n > variant.stock;
  const label = variantLabel(variant) ?? "Única";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-brand-muted tabular-nums">
          {variant.price !== null && variant.price > 0 ? formatPrice(variant.price) : "Sin precio"} · {variant.stock > 0 ? `Stock: ${variant.stock}` : "Sin stock"}
        </p>
      </div>
      {ok ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`qty-${variant.id}`}>Cantidad de {product.name} {label}</label>
          <input
            id={`qty-${variant.id}`} inputMode="numeric" value={qty} aria-invalid={n === null || overStock}
            onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setQty(e.target.value)}
            className={`${INPUT_CLASS} h-11 w-16 px-1 text-center tabular-nums`}
          />
          <Button variant="primary" icon="plus" disabled={n === null || overStock} onClick={() => n !== null && onAdd(product, variant, n)}>
            Agregar
          </Button>
        </div>
      ) : (
        <Badge tone="warn">{product.archived ? "Archivado" : variant.price === null || variant.price <= 0 ? "Sin precio" : "Sin stock"}</Badge>
      )}
      {ok && overStock && <p className="basis-full text-sm text-brand-danger">Solo hay {variant.stock} en stock.</p>}
    </li>
  );
}

function ReceiptCard({ receipt, onNew }: { receipt: Receipt; onNew: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-brand-green/40 bg-brand-green/5 p-4" role="status">
      <p className="flex items-center gap-2 font-semibold text-brand-green-ink">
        <Icon name="check" className="size-5" />
        {receipt.replayed ? "Esta venta ya estaba registrada" : "Venta confirmada"}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-brand-muted">Número</dt><dd className="font-medium tabular-nums">#{receipt.number}</dd>
        <dt className="text-brand-muted">Fecha</dt><dd className="tabular-nums">{dateTime.format(new Date(receipt.createdAt))}</dd>
        <dt className="text-brand-muted">Vendió</dt><dd>{receipt.userName}</dd>
        <dt className="text-brand-muted">Medio de pago</dt><dd>{receipt.paymentLabel}</dd>
      </dl>
      <ul className="mt-3 divide-y divide-brand-line/70 border-y border-brand-line/70 text-sm">
        {receipt.items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3 py-1.5">
            <span className="min-w-0">{i.quantity} × {i.productName}{i.variantLabel ? ` (${i.variantLabel})` : ""}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between text-lg font-semibold tabular-nums"><span>Total cobrado</span><span>{formatPrice(receipt.total)}</span></p>
      <p className="mt-1 text-xs text-brand-muted">
        {receipt.stockUpdated ? "Stock descontado: " : ""}
        {receipt.items.filter((i) => i.stockAfter !== null).map((i) => `${i.productName}: quedan ${i.stockAfter}`).join(" · ")}
      </p>
      <Button variant="primary" className="mt-3 w-full" onClick={onNew}>Nueva venta</Button>
    </div>
  );
}

function UnknownCode({ db, code, onDone }: { db: SupabaseClient; code: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${CARD_CLASS} p-4`} role="status">
      <p className="flex items-start gap-2 font-semibold"><Icon name="alert" className="mt-0.5 size-5 shrink-0 text-brand-danger" />No encontramos un producto con el código {code}</p>
      <p className="mt-1 text-sm text-brand-muted">No se agregó nada al carrito. Si es un producto nuevo, registralo: no se va a poder vender hasta que un gerente le cargue el stock.</p>
      <div className="mt-3">
        <Button onClick={() => setOpen(true)}>Registrar producto nuevo</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar producto nuevo" description={`Código ${code}`}>
        {open && <NewProductForm db={db} code={code} onClose={() => setOpen(false)} onDone={(m) => { setOpen(false); onDone(m); }} />}
      </Dialog>
    </div>
  );
}

function NewProductForm({ db, code, onClose, onDone }: { db: SupabaseClient; code: string; onClose: () => void; onDone: (message: string) => void }) {
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listCategories(db)
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
    const value = Number(price.replace(/\D/g, ""));
    if (!name.trim()) return setError("Escribí el nombre del producto.");
    if (!categoryId) return setError("Elegí una categoría.");
    if (!Number.isInteger(value) || value <= 0) return setError("Ingresá un precio entero mayor que 0, sin centavos.");
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await createScannedProduct(db, { barcode: code, name: name.trim(), categoryId, price: value });
      onDone("Producto registrado sin publicar y sin stock: todavía no se puede vender.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el producto.");
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <SelectInput label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categories === null}>
        {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectInput>
      <TextInput label="Precio (en pesos)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} hint="Pesos enteros, sin centavos." />
      {error && <p role="alert" className="text-sm text-brand-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Registrando…" : "Registrar producto"}</Button>
      </div>
    </form>
  );
}
