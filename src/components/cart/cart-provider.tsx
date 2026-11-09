"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  STORAGE_KEY, addLine, cartTotal, cartUnits, parseCart, removeLine, serializeCart, setLineQuantity,
  type AddResult, type Cart, type CartLine,
} from "@/lib/cart/public-cart";
import { CartDrawer } from "./cart-drawer";

/**
 * Estado del carrito público. Se guarda en localStorage (sobrevive a recargas y se comparte entre pestañas) y, si el
 * navegador no lo permite (modo privado, almacenamiento bloqueado), sigue funcionando en memoria durante la visita.
 * Es solo un armador de pedidos para WhatsApp: no es una venta ni se envía nada al servidor.
 */
const EVENT = "mp-cart-change";
let memory: string | null = null;
let memoryActive = false;

function readRaw(): string | null {
  if (memoryActive) return memory;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    memoryActive = true;
    return memory;
  }
}

function writeRaw(value: string | null) {
  try {
    if (!memoryActive) {
      if (value === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    memoryActive = true;
  }
  if (memoryActive) memory = value;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

type Ctx = {
  cart: Cart;
  units: number;
  total: number;
  /** false hasta que el navegador leyó lo guardado (evita mostrar «0» un instante antes de tiempo). */
  ready: boolean;
  add: (line: Omit<CartLine, "key" | "quantity">, quantity?: number) => AddResult["status"];
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  notify: (message: string) => void;
};

const CartContext = createContext<Ctx | null>(null);

export function useCart(): Ctx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}

const noopSubscribe = () => () => undefined;

export function CartProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const cart = useMemo(() => parseCart(raw), [raw]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(null), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = useCallback((next: Cart) => writeRaw(next.length === 0 ? null : serializeCart(next)), []);
  const current = useCallback(() => parseCart(readRaw()), []);

  const value = useMemo<Ctx>(
    () => ({
      cart,
      units: cartUnits(cart),
      total: cartTotal(cart),
      ready,
      add: (line, quantity = 1) => {
        const r = addLine(current(), line, quantity);
        if (r.status !== "full") commit(r.cart);
        return r.status;
      },
      setQuantity: (key, quantity) => commit(setLineQuantity(current(), key, quantity)),
      remove: (key) => commit(removeLine(current(), key)),
      clear: () => commit([]),
      open,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      notify,
    }),
    [cart, ready, open, commit, current, notify],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
      {/* Aviso breve y anunciado a lectores de pantalla: no mueve el foco ni tapa el contenido. */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6">
        {message && (
          <p className="cart-toast rounded-full bg-brand-charcoal px-4 py-2 text-sm font-medium text-white shadow-lg">{message}</p>
        )}
      </div>
    </CartContext.Provider>
  );
}
