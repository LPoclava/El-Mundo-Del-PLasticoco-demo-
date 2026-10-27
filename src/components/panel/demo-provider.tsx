"use client";

import {
  createContext, useCallback, useContext, useMemo, useReducer, useRef, useState,
  useSyncExternalStore, type ReactNode,
} from "react";
import { SESSION_USER, initialState } from "@/lib/panel-demo/data";
import type { Role } from "@/lib/panel-demo/roles";
import {
  activeChangeError, barcodeOwner, demoReducer, roleChangeError, validateBarcode,
  type DemoAction,
} from "@/lib/panel-demo/store";
import type { Actor, DemoProduct, DemoState, DemoUser } from "@/lib/panel-demo/types";
import { Toaster, type Toast, type ToastTone } from "./ui";

/**
 * Estado de la DEMOSTRACIÓN del panel. Todo vive en memoria del navegador: recargar la página
 * devuelve los datos ficticios al inicio. Solo el perfil elegido se recuerda mientras la
 * pestaña siga abierta (sessionStorage). Nada se envía a Supabase ni a ningún servidor.
 */

const KEY = "mp-demo-role";
type Stored = Role | "none";
let memory: Stored | undefined;
const listeners = new Set<() => void>();

function read(): Stored {
  if (memory === undefined) {
    try {
      const v = sessionStorage.getItem(KEY);
      memory = v === "empleado" || v === "gerente" || v === "ceo" ? v : "none";
    } catch {
      memory = "none";
    }
  }
  return memory;
}

function write(value: Stored) {
  memory = value;
  try {
    if (value === "none") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, value);
  } catch {
    // Sin almacenamiento (ventana privada): la sesión dura lo que dure la página.
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

type Actions = {
  setPrice: (id: string, price: number) => string | null;
  linkBarcode: (id: string, barcode: string) => string | null;
  createProduct: (input: Omit<DemoProduct, "id" | "published" | "archived">, via: "escáner" | "panel") => string | { error: string };
  updateProduct: (id: string, patch: Extract<DemoAction, { type: "update" }>["patch"]) => string | null;
  setPublished: (id: string, value: boolean) => void;
  setArchived: (id: string, value: boolean) => void;
  addCategory: (name: string) => string | null;
  renameCategory: (id: string, name: string) => string | null;
  deleteCategory: (id: string, moveTo: string | null) => string | null;
  addUser: (input: { name: string; email: string; role: Role }) => string | null;
  setUserRole: (id: string, role: Role) => string | null;
  setUserActive: (id: string, value: boolean) => string | null;
};

type Demo = {
  status: "loading" | "out" | "in";
  role: Role | null;
  actor: Actor | null;
  state: DemoState;
  actions: Actions;
  signIn: (role: Role) => void;
  signOut: () => void;
  resetData: () => void;
  notify: (message: string, tone?: ToastTone) => void;
};

const DemoContext = createContext<Demo | null>(null);

export function useDemo(): Demo {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo debe usarse dentro de DemoProvider");
  return ctx;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function DemoProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore<Stored | "loading">(subscribe, read, () => "loading");
  const [state, dispatch] = useReducer(demoReducer, undefined, initialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const status = stored === "loading" ? "loading" : stored === "none" ? "out" : "in";
  const role = stored === "loading" || stored === "none" ? null : stored;
  const actor = useMemo<Actor | null>(
    () => (role ? { ...SESSION_USER[role], role } : null),
    [role],
  );

  const notify = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const actions = useMemo<Actions>(() => {
    const meta = () => {
      if (!actor) throw new Error("Sin sesión de demostración");
      const n = ++counter.current;
      return { by: actor, at: new Date().toISOString(), eid: `aud-${n}` };
    };
    const send = (build: (m: ReturnType<typeof meta>) => DemoAction) => dispatch(build(meta()));

    return {
      setPrice: (id, price) => {
        send((m) => ({ type: "price", id, price, ...m }));
        return null;
      },
      linkBarcode: (id, barcode) => {
        const bad = validateBarcode(barcode);
        if (bad) return bad;
        const owner = barcodeOwner(state.products, barcode, id);
        if (owner) return `Ese código ya está asignado a «${owner.name}».`;
        send((m) => ({ type: "link", id, barcode: barcode.trim(), ...m }));
        return null;
      },
      createProduct: (input, via) => {
        if (input.barcode) {
          const bad = validateBarcode(input.barcode);
          if (bad) return { error: bad };
          const owner = barcodeOwner(state.products, input.barcode);
          if (owner) return { error: `Ese código ya está asignado a «${owner.name}».` };
        }
        const id = `prod-n${++counter.current}`;
        // Siempre sin publicar: igual que las funciones scan_* de la base.
        const product: DemoProduct = { ...input, id, published: false, archived: false };
        send((m) => ({ type: "create", product, via, ...m }));
        return id;
      },
      updateProduct: (id, patch) => {
        if (patch.barcode) {
          const bad = validateBarcode(patch.barcode);
          if (bad) return bad;
          const owner = barcodeOwner(state.products, patch.barcode, id);
          if (owner) return `Ese código ya está asignado a «${owner.name}».`;
        }
        send((m) => ({ type: "update", id, patch, ...m }));
        return null;
      },
      setPublished: (id, value) => send((m) => ({ type: "published", id, value, ...m })),
      setArchived: (id, value) => send((m) => ({ type: "archived", id, value, ...m })),
      addCategory: (name) => {
        const clean = name.trim();
        if (!clean) return "Escribí un nombre.";
        if (state.categories.some((c) => same(c.name, clean))) return "Ya existe una categoría con ese nombre.";
        send((m) => ({ type: "categoryAdd", category: { id: `cat-n${++counter.current}`, name: clean }, ...m }));
        return null;
      },
      renameCategory: (id, name) => {
        const clean = name.trim();
        if (!clean) return "Escribí un nombre.";
        if (state.categories.some((c) => c.id !== id && same(c.name, clean))) return "Ya existe una categoría con ese nombre.";
        send((m) => ({ type: "categoryRename", id, name: clean, ...m }));
        return null;
      },
      deleteCategory: (id, moveTo) => {
        const count = state.products.filter((p) => p.categoryId === id).length;
        if (count > 0 && !moveTo) return "Elegí a qué categoría pasar los productos antes de eliminarla.";
        send((m) => ({ type: "categoryDelete", id, moveTo, ...m }));
        return null;
      },
      addUser: ({ name, email, role: newRole }) => {
        if (!name.trim()) return "Escribí un nombre.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Escribí un correo válido.";
        if (state.users.some((u) => same(u.email, email))) return "Ya existe un usuario con ese correo.";
        const user: DemoUser = {
          id: `usr-n${++counter.current}`, name: name.trim(), email: email.trim(), role: newRole,
          active: true, createdAt: new Date().toISOString(),
        };
        send((m) => ({ type: "userAdd", user, ...m }));
        return null;
      },
      setUserRole: (id, newRole) => {
        const bad = roleChangeError(state.users, actor?.id ?? "", id, newRole);
        if (bad) return bad;
        send((m) => ({ type: "userRole", id, role: newRole, ...m }));
        return null;
      },
      setUserActive: (id, value) => {
        const bad = activeChangeError(state.users, actor?.id ?? "", id, value);
        if (bad) return bad;
        send((m) => ({ type: "userActive", id, value, ...m }));
        return null;
      },
    };
  }, [actor, state]);

  const resetData = useCallback(() => {
    dispatch({ type: "reset" });
    notify("Datos de demostración restablecidos.");
  }, [notify]);

  const value = useMemo<Demo>(
    () => ({
      status, role, actor, state, actions, notify, resetData,
      signIn: (r) => write(r),
      signOut: () => {
        dispatch({ type: "reset" });
        write("none");
      },
    }),
    [status, role, actor, state, actions, notify, resetData],
  );

  return (
    <DemoContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} />
    </DemoContext.Provider>
  );
}
