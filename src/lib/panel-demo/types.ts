import type { Role } from "./roles";

/** Tipos del panel de demostración. Los ids son texto libre: no asumen el formato de Supabase. */
export type DemoCategory = { id: string; name: string };

export type DemoProduct = {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  /** Pesos enteros, igual que en la base real. */
  price: number;
  barcode: string | null;
  published: boolean;
  archived: boolean;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type AuditAction =
  | "price" | "create" | "link" | "publish" | "unpublish"
  | "archive" | "unarchive" | "edit" | "category" | "user";

export type AuditEntry = {
  id: string;
  at: string;
  userId: string;
  userName: string;
  role: Role;
  action: AuditAction;
  /** "catalogo" lo ve el gerente; "usuarios" solo el CEO. */
  scope: "catalogo" | "usuarios";
  target: string;
  from?: string;
  to?: string;
};

export type DemoState = {
  products: DemoProduct[];
  categories: DemoCategory[];
  users: DemoUser[];
  audit: AuditEntry[];
};

export type Actor = { id: string; name: string; role: Role };
