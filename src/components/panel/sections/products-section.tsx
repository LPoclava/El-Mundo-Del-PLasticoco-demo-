"use client";

import { useMemo, useState } from "react";
import { formatPrice, normalize } from "@/lib/panel-demo/format";
import type { DemoProduct } from "@/lib/panel-demo/types";
import { useDemo } from "../demo-provider";
import { Icon } from "../icons";
import {
  Badge, Button, CARD_CLASS, ConfirmDialog, EmptyState, INPUT_CLASS, Notice, PageHeader, ProductThumb,
} from "../ui";
import { ProductFormSheet } from "./product-form";

const PAGE_SIZE = 8;

type StatusFilter = "todos" | "publicados" | "sin-publicar" | "archivados";
type SortKey = "name" | "price-asc" | "price-desc" | "category";

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ["todos", "Todos los estados"], ["publicados", "Publicados"], ["sin-publicar", "Sin publicar"], ["archivados", "Archivados"],
];
const SORT_OPTIONS: [SortKey, string][] = [
  ["name", "Nombre (A-Z)"], ["price-asc", "Precio: menor a mayor"], ["price-desc", "Precio: mayor a menor"], ["category", "Categoría"],
];

type Pending = { product: DemoProduct; kind: "unpublish" | "archive" } | null;

function StatusBadges({ p }: { p: DemoProduct }) {
  return (
    <span className="flex flex-wrap gap-1">
      {p.published ? <Badge tone="ok">Publicado</Badge> : <Badge tone="warn">Sin publicar</Badge>}
      {p.archived && <Badge tone="muted">Archivado</Badge>}
    </span>
  );
}

export function ProductsSection() {
  const { state, actions, notify } = useDemo();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DemoProduct | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const categoryName = (id: string) => state.categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  const rows = useMemo(() => {
    const term = normalize(q.trim());
    const list = state.products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (status === "publicados" && !(p.published && !p.archived)) return false;
      if (status === "sin-publicar" && !(!p.published && !p.archived)) return false;
      if (status === "archivados" && !p.archived) return false;
      if (term && !normalize(`${p.name} ${p.brand} ${p.barcode ?? ""}`).includes(term)) return false;
      return true;
    });
    const cat = (id: string) => state.categories.find((c) => c.id === id)?.name ?? "";
    return [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "category") return cat(a.categoryId).localeCompare(cat(b.categoryId), "es") || a.name.localeCompare(b.name, "es");
      return a.name.localeCompare(b.name, "es");
    });
  }, [state.products, state.categories, q, categoryId, status, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = Boolean(q || categoryId || status !== "todos");

  function openEditor(p: DemoProduct | null) {
    setEditing(p);
    setSheetOpen(true);
  }

  function confirm() {
    if (!pending) return;
    if (pending.kind === "unpublish") {
      actions.setPublished(pending.product.id, false);
      notify(`«${pending.product.name}» ya no se muestra en el catálogo (simulación).`);
    } else {
      actions.setArchived(pending.product.id, true);
      notify(`«${pending.product.name}» archivado (simulación).`);
    }
    setPending(null);
  }

  // compact: solo íconos (tabla de escritorio); el nombre queda en title y aria-label.
  const actionsFor = (p: DemoProduct, compact: boolean) => {
    const btn = (label: string, icon: "edit" | "eye" | "eyeOff" | "archive", onClick: () => void) => (
      <Button size="sm" icon={icon} onClick={onClick} aria-label={`${label} ${p.name}`} title={label} className={compact ? "w-9 px-0" : ""}>
        {compact ? null : label}
      </Button>
    );
    return (
      <div className={`flex flex-wrap gap-1.5 ${compact ? "justify-end" : ""}`}>
        {btn("Editar", "edit", () => openEditor(p))}
        {!p.archived &&
          (p.published
            ? btn("Despublicar", "eyeOff", () => setPending({ product: p, kind: "unpublish" }))
            : btn("Publicar", "eye", () => { actions.setPublished(p.id, true); notify(`«${p.name}» publicado (simulación).`); }))}
        {p.archived
          ? btn("Desarchivar", "archive", () => { actions.setArchived(p.id, false); notify(`«${p.name}» desarchivado (simulación).`); })
          : btn("Archivar", "archive", () => setPending({ product: p, kind: "archive" }))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        subtitle="Creá, editá, publicá y archivá productos. Archivar no los elimina."
        actions={<Button variant="primary" icon="plus" onClick={() => openEditor(null)}>Crear producto</Button>}
      />

      <Notice tone="demo">
        Productos ficticios de demostración. Las imágenes son marcadores: la carga de fotos se conectará con el almacenamiento real.
      </Notice>

      <section className={`${CARD_CLASS} p-4`} aria-label="Filtros">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="prod-q" className="mb-1.5 block text-sm font-medium">Buscar</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-muted" />
              <input id="prod-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nombre, marca o código" className={`${INPUT_CLASS} pl-9`} />
            </div>
          </div>
          <div>
            <label htmlFor="prod-cat" className="mb-1.5 block text-sm font-medium">Categoría</label>
            <select id="prod-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="prod-status" className="mb-1.5 block text-sm font-medium">Estado</label>
            <select id="prod-status" value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }} className={INPUT_CLASS}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="prod-sort" className="mb-1.5 block text-sm font-medium">Ordenar por</label>
            <select id="prod-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={INPUT_CLASS}>
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      <p className="text-sm text-brand-muted" aria-live="polite">
        {rows.length === 1 ? "1 producto" : `${rows.length} productos`}
        {hasFilters && (
          <>
            {" · "}
            <button type="button" className="font-medium text-brand-ink underline underline-offset-4" onClick={() => { setQ(""); setCategoryId(""); setStatus("todos"); setPage(1); }}>Quitar filtros</button>
          </>
        )}
      </p>

      {visible.length === 0 ? (
        <EmptyState title="No hay productos con esos filtros" action={<Button onClick={() => { setQ(""); setCategoryId(""); setStatus("todos"); }}>Quitar filtros</Button>}>
          Probá con otra palabra o con otro estado.
        </EmptyState>
      ) : (
        <>
          <div className={`${CARD_CLASS} hidden overflow-x-auto md:block`}>
            <table className="w-full text-sm">
              <caption className="sr-only">Listado de productos de demostración</caption>
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Producto</th>
                  <th scope="col" className="px-3 py-3 font-medium">Categoría</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Precio</th>
                  <th scope="col" className="px-3 py-3 font-medium">Código</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {visible.map((p) => (
                  <tr key={p.id} className={p.archived ? "bg-brand-cream/60" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb seed={p.categoryId} className="size-11" />
                        <div className="min-w-0">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-brand-muted">{p.brand || "Sin marca"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{categoryName(p.categoryId)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{formatPrice(p.price)}</td>
                    <td className="px-3 py-3 tabular-nums text-brand-muted">{p.barcode ?? "Sin código"}</td>
                    <td className="px-3 py-3"><StatusBadges p={p} /></td>
                    <td className="px-4 py-3">{actionsFor(p, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map((p) => (
              <li key={p.id} className={`${CARD_CLASS} p-4 ${p.archived ? "bg-brand-cream/60" : ""}`}>
                <div className="flex items-start gap-3">
                  <ProductThumb seed={p.categoryId} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-brand-muted">{p.brand || "Sin marca"} · {categoryName(p.categoryId)}</p>
                    <p className="mt-1 text-xs tabular-nums text-brand-muted">{p.barcode ?? "Sin código"}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatPrice(p.price)}</p>
                </div>
                <div className="mt-3"><StatusBadges p={p} /></div>
                <div className="mt-3">{actionsFor(p, false)}</div>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
              <Button size="sm" icon="chevronLeft" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</Button>
              <p className="text-sm text-brand-muted tabular-nums">Página {current} de {pageCount}</p>
              <Button size="sm" disabled={current === pageCount} onClick={() => setPage(current + 1)}>Siguiente <Icon name="chevronRight" className="size-4" /></Button>
            </nav>
          )}
        </>
      )}

      <ProductFormSheet product={editing} open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        danger
        title={pending?.kind === "archive" ? "¿Archivar este producto?" : "¿Despublicar este producto?"}
        confirmLabel={pending?.kind === "archive" ? "Archivar" : "Despublicar"}
      >
        {pending?.kind === "archive"
          ? <>«{pending.product.name}» deja de mostrarse en el catálogo y se conserva con todos sus datos. Se puede desarchivar después.</>
          : <>«{pending?.product.name}» deja de mostrarse en el catálogo, pero no se archiva ni se borra.</>}
      </ConfirmDialog>
    </div>
  );
}
