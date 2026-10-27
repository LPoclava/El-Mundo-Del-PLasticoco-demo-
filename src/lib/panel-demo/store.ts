import { formatPrice } from "./format";
import type { Role } from "./roles";
import type {
  Actor, AuditAction, AuditEntry, DemoCategory, DemoProduct, DemoState, DemoUser,
} from "./types";
import { initialState } from "./data";

/** Reglas de negocio de la demo. Reflejan las de la base real, pero aquí son solo de interfaz. */

export function validateBarcode(code: string): string | null {
  return /^[0-9]{8,14}$/.test(code.trim()) ? null : "El código debe tener entre 8 y 14 dígitos.";
}

export function barcodeOwner(products: DemoProduct[], code: string, exceptId?: string): DemoProduct | undefined {
  return products.find((p) => p.barcode === code.trim() && p.id !== exceptId);
}

export function parsePrice(raw: string): number | null {
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isInteger(n) && n > 0 && n < 1_000_000_000 ? n : null;
}

export function activeCeoCount(users: DemoUser[], exceptId?: string): number {
  return users.filter((u) => u.role === "ceo" && u.active && u.id !== exceptId).length;
}

export function roleChangeError(users: DemoUser[], actorId: string, targetId: string, role: Role): string | null {
  if (actorId === targetId) return "No podés cambiar tu propio rol.";
  const target = users.find((u) => u.id === targetId);
  if (!target) return "Usuario no encontrado.";
  if (target.role === "ceo" && target.active && role !== "ceo" && activeCeoCount(users, targetId) === 0) {
    return "No se puede dejar la aplicación sin un CEO activo.";
  }
  return null;
}

export function activeChangeError(users: DemoUser[], actorId: string, targetId: string, active: boolean): string | null {
  if (actorId === targetId) return "No podés desactivarte a vos mismo.";
  const target = users.find((u) => u.id === targetId);
  if (!target) return "Usuario no encontrado.";
  if (!active && target.role === "ceo" && target.active && activeCeoCount(users, targetId) === 0) {
    return "No se puede dejar la aplicación sin un CEO activo.";
  }
  return null;
}

type Meta = { by: Actor; at: string; eid: string };

export type DemoAction =
  | ({ type: "price"; id: string; price: number } & Meta)
  | ({ type: "link"; id: string; barcode: string } & Meta)
  | ({ type: "create"; product: DemoProduct; via: "escáner" | "panel" } & Meta)
  | ({ type: "update"; id: string; patch: Partial<Pick<DemoProduct, "name" | "brand" | "categoryId" | "price" | "barcode">> } & Meta)
  | ({ type: "published"; id: string; value: boolean } & Meta)
  | ({ type: "archived"; id: string; value: boolean } & Meta)
  | ({ type: "categoryAdd"; category: DemoCategory } & Meta)
  | ({ type: "categoryRename"; id: string; name: string } & Meta)
  | ({ type: "categoryDelete"; id: string; moveTo: string | null } & Meta)
  | ({ type: "userAdd"; user: DemoUser } & Meta)
  | ({ type: "userRole"; id: string; role: Role } & Meta)
  | ({ type: "userActive"; id: string; value: boolean } & Meta)
  | { type: "reset" };

function entry(
  m: Meta, action: AuditAction, scope: AuditEntry["scope"], target: string, from?: string, to?: string,
): AuditEntry {
  return { id: m.eid, at: m.at, userId: m.by.id, userName: m.by.name, role: m.by.role, action, scope, target, from, to };
}

const log = (s: DemoState, e: AuditEntry): DemoState => ({ ...s, audit: [e, ...s.audit] });

const patchProduct = (s: DemoState, id: string, fn: (p: DemoProduct) => DemoProduct): DemoState => ({
  ...s,
  products: s.products.map((p) => (p.id === id ? fn(p) : p)),
});

const FIELD_NAME: Record<string, string> = { name: "nombre", brand: "marca", categoryId: "categoría", price: "precio", barcode: "código" };

export function demoReducer(s: DemoState, a: DemoAction): DemoState {
  if (a.type === "reset") return initialState();

  switch (a.type) {
    case "price": {
      const p = s.products.find((x) => x.id === a.id);
      if (!p || p.price === a.price) return s;
      return log(patchProduct(s, a.id, (x) => ({ ...x, price: a.price })), entry(a, "price", "catalogo", p.name, formatPrice(p.price), formatPrice(a.price)));
    }
    case "link": {
      const p = s.products.find((x) => x.id === a.id);
      if (!p || p.barcode === a.barcode) return s;
      return log(patchProduct(s, a.id, (x) => ({ ...x, barcode: a.barcode })), entry(a, "link", "catalogo", p.name, p.barcode ?? "Sin código", a.barcode));
    }
    case "create":
      return log({ ...s, products: [a.product, ...s.products] }, entry(a, "create", "catalogo", a.product.name, undefined, `Creado sin publicar (${a.via})`));
    case "update": {
      const p = s.products.find((x) => x.id === a.id);
      if (!p) return s;
      const keys = (Object.keys(a.patch) as (keyof typeof a.patch)[]).filter((k) => a.patch[k] !== p[k]);
      if (keys.length === 0) return s;
      const next = patchProduct(s, a.id, (x) => ({ ...x, ...a.patch }));
      if (keys.length === 1 && keys[0] === "price") {
        return log(next, entry(a, "price", "catalogo", p.name, formatPrice(p.price), formatPrice(a.patch.price ?? p.price)));
      }
      return log(next, entry(a, "edit", "catalogo", p.name, undefined, `Campos: ${keys.map((k) => FIELD_NAME[k]).join(", ")}`));
    }
    case "published": {
      const p = s.products.find((x) => x.id === a.id);
      if (!p || p.published === a.value) return s;
      return log(patchProduct(s, a.id, (x) => ({ ...x, published: a.value })), entry(a, a.value ? "publish" : "unpublish", "catalogo", p.name, a.value ? "Sin publicar" : "Publicado", a.value ? "Publicado" : "Sin publicar"));
    }
    case "archived": {
      const p = s.products.find((x) => x.id === a.id);
      if (!p || p.archived === a.value) return s;
      return log(patchProduct(s, a.id, (x) => ({ ...x, archived: a.value })), entry(a, a.value ? "archive" : "unarchive", "catalogo", p.name, a.value ? "Activo" : "Archivado", a.value ? "Archivado" : "Activo"));
    }
    case "categoryAdd":
      return log({ ...s, categories: [...s.categories, a.category] }, entry(a, "category", "catalogo", a.category.name, undefined, "Categoría creada"));
    case "categoryRename": {
      const c = s.categories.find((x) => x.id === a.id);
      if (!c || c.name === a.name) return s;
      return log({ ...s, categories: s.categories.map((x) => (x.id === a.id ? { ...x, name: a.name } : x)) }, entry(a, "category", "catalogo", a.name, c.name, a.name));
    }
    case "categoryDelete": {
      const c = s.categories.find((x) => x.id === a.id);
      if (!c) return s;
      const moved = s.products.filter((p) => p.categoryId === a.id);
      if (moved.length > 0 && !a.moveTo) return s;
      const to = s.categories.find((x) => x.id === a.moveTo);
      return log(
        {
          ...s,
          categories: s.categories.filter((x) => x.id !== a.id),
          products: s.products.map((p) => (p.categoryId === a.id && a.moveTo ? { ...p, categoryId: a.moveTo } : p)),
        },
        entry(a, "category", "catalogo", c.name, moved.length ? `${moved.length} productos` : undefined, to ? `Reasignados a ${to.name}` : "Categoría eliminada"),
      );
    }
    case "userAdd":
      return log({ ...s, users: [...s.users, a.user] }, entry(a, "user", "usuarios", a.user.name, undefined, `Alta como ${a.user.role}`));
    case "userRole": {
      const u = s.users.find((x) => x.id === a.id);
      if (!u || u.role === a.role) return s;
      return log({ ...s, users: s.users.map((x) => (x.id === a.id ? { ...x, role: a.role } : x)) }, entry(a, "user", "usuarios", u.name, u.role, a.role));
    }
    case "userActive": {
      const u = s.users.find((x) => x.id === a.id);
      if (!u || u.active === a.value) return s;
      return log({ ...s, users: s.users.map((x) => (x.id === a.id ? { ...x, active: a.value } : x)) }, entry(a, "user", "usuarios", u.name, u.active ? "Activo" : "Inactivo", a.value ? "Activo" : "Inactivo"));
    }
  }
}
