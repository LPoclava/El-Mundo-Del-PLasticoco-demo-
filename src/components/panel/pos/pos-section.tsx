"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addToCart, applyProblems, attemptSignature, cartTotal, cartUnits, changeQuantity, describeProblem, removeLine,
  setQuantity, type Cart, type SaleProblem,
} from "@/lib/pos/cart";
import {
  confirmSale, findProducts, isBarcode, listPaymentMethods, toCartLine, variantLabel,
  type PaymentMethod, type PosProduct, type PosVariant, type Receipt,
} from "@/lib/pos/api";
import { BarcodeScanner } from "../barcode-scanner";
import { Icon } from "../icons";
import { Button, CARD_CLASS, INPUT_CLASS, Toaster, type Toast } from "../ui";
import { CartScreen } from "./pos-cart-screen";
import { PosGate } from "./pos-gate";
import { RecentSales } from "./pos-recent-sales";
import { ResultPanel, resultTitle, type ScanResult } from "./pos-result-panel";

/**
 * Escáner como centro de operaciones (prueba piloto): consultar un producto, registrar uno nuevo,
 * agregar a la venta y actualizar stock. El resultado de cada lectura aparece en la parte de arriba de la
 * página (no en un modal) y la venta tiene su propia pantalla (?vista=venta), con la que funciona el botón
 * «atrás» del navegador. La venta real la valida y registra confirm_sale() en PostgreSQL
 * (permisos, precios, stock, total, idempotencia): esta pantalla es solo la interfaz.
 */
export function PosSection() {
  return <PosGate>{({ db, role }) => <Scanner db={db} role={role} />}</PosGate>;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3000);
  }, []);
  return { toasts, push };
}

type Matches = { term: string; products: PosProduct[] } | null;

function Scanner({ db, role }: { db: SupabaseClient; role: "empleado" | "gerente" | "ceo" }) {
  const canManage = role !== "empleado";
  const [cart, setCart] = useState<Cart>([]);
  const cartRef = useRef<Cart>([]);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const resultOpen = useRef(false);
  const lookupBusy = useRef(false);
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<Matches>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; details: string[] } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [salesVersion, setSalesVersion] = useState(0);
  const sendingRef = useRef(false);
  const attemptRef = useRef<{ sig: string; key: string } | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const { toasts, push } = useToasts();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onSale = searchParams.get("vista") === "venta";
  const resultRef = useRef<HTMLElement>(null);

  // El resultado aparece arriba de la página: se lleva a la vista y se anuncia sin mover el foco del lector.
  const hasResult = result !== null;
  useEffect(() => {
    if (hasResult) resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [hasResult]);

  const openSale = () => router.push("/panel/precios?vista=venta");
  const backToScanner = () => {
    setFailure(null);
    if (cartRef.current.length === 0) setReceipt(null);
    router.push("/panel/precios");
  };

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

  function showResult(next: ScanResult | null) {
    resultOpen.current = next !== null;
    setResult(next);
  }

  /** Busca un código o nombre y muestra el resultado ENSEGUIDA (primero «buscando», después el producto). */
  async function lookup(raw: string, source: "camera" | "manual" | "refresh") {
    const value = raw.trim();
    if (value.length < 2 || lookupBusy.current) return;
    lookupBusy.current = true;
    if (source !== "refresh") showResult({ kind: "loading", code: value });
    try {
      const products = await findProducts(db, value);
      if (isBarcode(value) || source !== "manual") {
        const exact = products.find((p) => p.barcode === value) ?? (source === "refresh" ? products[0] : undefined);
        showResult(exact ? { kind: "product", product: exact } : { kind: "unknown", code: value });
      } else {
        // Búsqueda por nombre desde el campo manual: lista para elegir.
        showResult(null);
        setMatches({ term: value, products });
      }
    } catch (e) {
      showResult(null);
      push(e instanceof Error ? e.message : "No se pudo buscar.", "error");
    } finally {
      lookupBusy.current = false;
    }
  }

  function onDetect(code: string) {
    // Con el resultado de otra lectura abierto no se apilan paneles.
    if (resultOpen.current) return;
    setMatches(null);
    void lookup(code, "camera");
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    setMatches(null);
    void lookup(term, "manual");
  }

  function add(product: PosProduct, variant: PosVariant, quantity: number) {
    const r = addToCart(cartRef.current, toCartLine(product, variant), quantity);
    updateCart(r.cart);
    if (r.added) {
      setReceipt(null);
      showResult(null);
      push(`Agregado: ${product.name}${variantLabel(variant) ? ` (${variantLabel(variant)})` : ""}`);
    } else if (r.reason === "no-stock") push(`«${product.name}» no tiene stock.`, "error");
    else push(`No hay más stock de «${product.name}».`, "error");
  }

  const total = cartTotal(cart);
  const units = cartUnits(cart);

  async function confirm() {
    // Doble clic o toque repetido: mientras haya un envío en curso no se manda otro.
    if (sendingRef.current || method === null || cartRef.current.length === 0) return;
    sendingRef.current = true;
    setBusy(true);
    setFailure(null);
    // Una clave por intento: se reutiliza si es el mismo carrito (reintento tras un corte de red) y
    // cambia en cuanto se edita algo.
    const sig = attemptSignature(cartRef.current, method);
    if (attemptRef.current?.sig !== sig) attemptRef.current = { sig, key: crypto.randomUUID() };
    const outcome = await confirmSale(db, attemptRef.current.key, method, cartRef.current);
    sendingRef.current = false;
    setBusy(false);

    if ("receipt" in outcome) {
      // Recién ahora, con la confirmación real del servidor, se limpia el carrito.
      updateCart([]);
      setMethod(null);
      attemptRef.current = null;
      setReceipt(outcome.receipt);
      setSalesVersion((v) => v + 1);
      return;
    }
    const f = outcome.failure;
    if (f.kind === "rejected") {
      updateCart(applyProblems(cartRef.current, f.problems as SaleProblem[]));
      attemptRef.current = null;
    }
    setFailure({ message: f.message, details: f.problems.map(describeProblem) });
  }

  const cartActions = {
    setQuantity: (id: string, n: number) => updateCart(setQuantity(cartRef.current, id, n)),
    step: (id: string, d: 1 | -1) => updateCart(changeQuantity(cartRef.current, id, d)),
    remove: (id: string) => updateCart(removeLine(cartRef.current, id)),
    clear: () => { updateCart([]); setMethod(null); attemptRef.current = null; setFailure(null); },
  };

  if (onSale) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon="chevronLeft" onClick={backToScanner} className="-ml-2">Volver al escáner</Button>
        <CartScreen
          onBack={backToScanner}
          cart={cart}
          actions={cartActions}
          methods={methods}
          method={method}
          onMethod={setMethod}
          busy={busy}
          failure={failure}
          receipt={receipt}
          onConfirm={() => void confirm()}
          onNewSale={() => { setReceipt(null); router.push("/panel/precios"); }}
        />
        <Toaster toasts={toasts} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Resultado de la última lectura: arriba de la página, en línea (no es un modal). */}
      {result && (
        <section ref={resultRef} aria-labelledby="resultado-titulo" className={`${CARD_CLASS} scroll-mt-20 border-brand-ink/20 p-4 shadow-sm sm:p-5`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id="resultado-titulo" aria-live="polite" className="min-w-0 text-lg font-semibold leading-snug">{resultTitle(result)}</h2>
            <button
              type="button"
              onClick={() => showResult(null)}
              aria-label="Cerrar el resultado y seguir escaneando"
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-sand hover:text-brand-ink"
            >
              <Icon name="x" />
            </button>
          </div>
          <ResultPanel
            db={db} result={result} canManage={canManage} onClose={() => showResult(null)}
            onAdd={add} onNotify={push}
            onRefresh={(code) => lookup(code, "refresh")}
          />
        </section>
      )}

      <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-label="Escáner de códigos de barras">
        <BarcodeScanner
          continuous
          startLabel="Escanear producto"
          onDetect={onDetect}
          onManual={() => requestAnimationFrame(() => manualRef.current?.focus())}
        />
      </section>

      <section className="rounded-xl border border-brand-line bg-white/60 p-4" aria-label="Búsqueda manual">
        <form onSubmit={onManualSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="pos-search" className="mb-1.5 block text-sm font-medium">¿Sin cámara? Escribí el código o el nombre</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-muted" />
              <input
                id="pos-search" ref={manualRef} type="search" autoComplete="off" value={term} maxLength={80}
                placeholder="Código de barras o nombre del producto"
                onChange={(e) => setTerm(e.target.value)} className={`${INPUT_CLASS} pl-9`}
              />
            </div>
          </div>
          <Button type="submit" icon="search" disabled={term.trim().length < 2}>Buscar</Button>
        </form>

        {matches && (
          <div className="mt-3" aria-live="polite">
            {matches.products.length === 0 ? (
              <p className="text-sm text-brand-muted">No encontramos productos para «{matches.term}». Probá con otra palabra o con el código de barras.</p>
            ) : (
              <ul className="divide-y divide-brand-line rounded-lg border border-brand-line bg-white">
                {matches.products.map((p) => (
                  <li key={p.productId}>
                    <button
                      type="button"
                      onClick={() => { setMatches(null); showResult({ kind: "product", product: p }); }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-brand-sand"
                    >
                      <span className="min-w-0 font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-brand-muted">{p.barcode ?? "Sin código"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <RecentSales db={db} methods={methods ?? []} version={salesVersion} showAll={canManage} />

      {/* Carrito flotante: abajo a la derecha, siempre a mano mientras se escanea. */}
      <button
        type="button"
        onClick={openSale}
        aria-label={`Ir a la venta: ${units} ${units === 1 ? "unidad" : "unidades"}${units > 0 ? `, total ${total.toLocaleString("es-AR")} pesos` : ""}`}
        className={`fixed bottom-4 right-4 z-30 flex h-14 items-center gap-2 rounded-full px-4 shadow-lg ring-1 ring-black/5 motion-safe:transition motion-safe:active:scale-95 sm:bottom-6 sm:right-6 ${
          units > 0 ? "bg-brand-orange text-brand-ink hover:bg-brand-orange/90" : "bg-white text-brand-ink hover:bg-brand-sand"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.95-1.5L21 8H6.2" />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="17" cy="20" r="1.2" />
        </svg>
        <span className="min-w-6 rounded-full bg-brand-ink px-2 py-0.5 text-center text-sm font-semibold tabular-nums text-white" aria-hidden>{units}</span>
      </button>

      <Toaster toasts={toasts} />
    </div>
  );
}
