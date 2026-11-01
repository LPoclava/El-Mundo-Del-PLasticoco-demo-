"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import {
  ADMIN_PAGE_SIZE, listCategories, listProducts, setArchived, setPublished, type CategoryOption, type ListFilters,
  type ProductListItem, type StatusFilter,
} from "@/lib/products/admin";
import { hiddenReasons, publishBlockers } from "@/lib/products/rules";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { takeFlash } from "../flash";
import { SupabaseGate } from "../supabase-gate";
import { useToasts } from "../use-toasts";
import {
  Badge, Button, CARD_CLASS, Dialog, EmptyState, INPUT_CLASS, LinkButton, Notice, PageHeader, ProductThumb, Toaster,
} from "../ui";

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ["todos", "Todos los estados"], ["publicados", "Publicados"], ["sin-publicar", "Sin publicar"], ["archivados", "Archivados"],
];

/**
 * Productos REALES (Supabase), con la sesión de quien administra. Qué puede hacer cada persona lo
 * decide la base: RLS exige rol gerente o superior. Los botones deshabilitados son comodidad.
 */
export function ProductsSection() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Productos" subtitle="Creá, editá, publicá y archivá productos. Archivar no los elimina." />
      {isBrowserSupabaseConfigured ? (
        <SupabaseGate action="administrar productos">{(db) => <Manager db={db} />}</SupabaseGate>
      ) : (
        <Notice tone="warn" title="Falta configurar la conexión">
          Sin la conexión con la base de datos no se puede leer ni guardar nada acá. Avisá a quien administra el sistema.
        </Notice>
      )}
    </div>
  );
}

type Result = { key: string; items: ProductListItem[]; total: number } | { key: string; error: string };
type Pending = { product: ProductListItem; kind: "unpublish" | "archive" } | null;

function StatusBadges({ p }: { p: ProductListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {p.publishEnabled ? <Badge tone="ok">Publicado</Badge> : <Badge tone="warn">Sin publicar</Badge>}
      {p.archivedAt && <Badge tone="muted">Archivado</Badge>}
    </span>
  );
}

function Manager({ db }: { db: SupabaseClient }) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [unpublished, setUnpublished] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const key = `${q}|${categoryId}|${status}|${page}|${reload}`;
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  // Enlaces viejos con ?editar=<id> (antes la edición era un modal) llevan a la pantalla de edición.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("editar");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) router.replace(`/panel/productos/${id}`);
  }, [router]);

  // Aviso de la pantalla de edición («Producto guardado»): se muestra al volver al listado.
  useEffect(() => {
    const flash = takeFlash();
    if (flash) push(flash.message, flash.tone);
  }, [push]);

  // Indicador «sin publicar» (antes estaba en el inicio): productos activos que todavía no se ven en el catálogo.
  useEffect(() => {
    let cancelled = false;
    listProducts(db, { q: "", categoryId: "", status: "sin-publicar", page: 1 })
      .then((r) => !cancelled && setUnpublished(r.total))
      .catch(() => !cancelled && setUnpublished(null));
    return () => {
      cancelled = true;
    };
  }, [db, reload]);

  useEffect(() => {
    let cancelled = false;
    listCategories(db)
      .then((list) => !cancelled && setCategories(list))
      .catch((e: unknown) => !cancelled && push(e instanceof Error ? e.message : "No se pudieron leer las categorías.", "error"));
    return () => {
      cancelled = true;
    };
  }, [db, push]);

  // La búsqueda se envía al servidor un instante después de dejar de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    let cancelled = false;
    const filters: ListFilters = { q, categoryId, status, page };
    listProducts(db, filters)
      .then((r) => !cancelled && setResult({ key, items: r.items, total: r.total }))
      .catch((e: unknown) => !cancelled && setResult({ key, error: e instanceof Error ? e.message : "No se pudo leer el listado." }));
    return () => {
      cancelled = true;
    };
  }, [db, key, q, categoryId, status, page]);

  const loading = result?.key !== key;
  const items = result && "items" in result ? result.items : [];
  const total = result && "items" in result ? result.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hasFilters = Boolean(q || categoryId || status !== "todos");
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? "Sin categoría";

  async function act(product: ProductListItem, run: () => Promise<void>, ok: string) {
    setBusyId(product.id);
    try {
      await run();
      push(ok);
      refresh();
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo completar la acción.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-brand-muted" aria-live="polite">
            {loading ? "Cargando…" : total === 1 ? "1 producto" : `${total} productos`}
          </p>
          {unpublished !== null && unpublished > 0 && (
            <button
              type="button"
              onClick={() => { setStatus("sin-publicar"); setPage(1); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-orange/20 px-3 text-sm font-medium hover:bg-brand-orange/30"
            >
              {unpublished === 1 ? "1 sin publicar" : `${unpublished} sin publicar`}
              <span className="text-xs font-normal text-brand-muted">ver</span>
            </button>
          )}
        </div>
        <LinkButton href="/panel/productos/nuevo" variant="primary" icon="plus">Crear producto</LinkButton>
      </div>

      <section className={`${CARD_CLASS} p-4`} aria-label="Filtros">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="prod-q" className="mb-1.5 block text-sm font-medium">Buscar</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-muted" />
              <input id="prod-q" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Nombre, marca, descripción o código" className={`${INPUT_CLASS} pl-9`} />
            </div>
          </div>
          <div>
            <label htmlFor="prod-cat" className="mb-1.5 block text-sm font-medium">Categoría</label>
            <select id="prod-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="prod-status" className="mb-1.5 block text-sm font-medium">Estado</label>
            <select id="prod-status" value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }} className={INPUT_CLASS}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <button type="button" className="mt-3 text-sm font-medium underline underline-offset-4" onClick={() => { setQInput(""); setQ(""); setCategoryId(""); setStatus("todos"); setPage(1); }}>
            Quitar filtros
          </button>
        )}
      </section>

      {result && "error" in result && !loading ? (
        <div className="space-y-3">
          <Notice tone="warn" title="No se pudo cargar el listado">{result.error}</Notice>
          <Button onClick={refresh}>Reintentar</Button>
        </div>
      ) : loading && !result ? (
        <p role="status" className="text-sm text-brand-muted">Cargando productos…</p>
      ) : items.length === 0 && !loading ? (
        hasFilters ? (
          <EmptyState title="No hay productos con esos filtros">Probá con otra palabra o con otro estado.</EmptyState>
        ) : (
          <EmptyState title="Todavía no hay productos" action={<LinkButton href="/panel/productos/nuevo" variant="primary" icon="plus">Crear el primer producto</LinkButton>}>
            Los productos que crees acá se guardan en la base y, con foto principal y precio, aparecen en el catálogo.
          </EmptyState>
        )
      ) : (
        <section className={CARD_CLASS} aria-label="Listado de productos" aria-busy={loading}>
          <ul className={`divide-y divide-brand-line ${loading ? "opacity-60" : ""}`}>
            {items.map((p) => {
              const prices = p.prices;
              const valid = prices.filter((x): x is number => x !== null && x > 0);
              const blockers = publishBlockers({ hasPrimaryImage: p.primaryPath !== null, prices });
              const reasons = hiddenReasons({ publishEnabled: p.publishEnabled, archivedAt: p.archivedAt, hasPrimaryImage: p.primaryPath !== null, prices });
              const busy = busyId === p.id;
              return (
                <li key={p.id} className={`px-4 py-4 ${p.archivedAt ? "bg-brand-cream/60" : ""}`}>
                  <div className="flex items-start gap-3">
                    {p.primaryPath ? (
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-brand-sand">
                        <Image src={productImageUrl(p.primaryPath)} alt={p.name} fill sizes="56px" className="object-cover" />
                      </span>
                    ) : (
                      <ProductThumb seed={p.id} className="size-14" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words font-medium">{p.name}</p>
                        <StatusBadges p={p} />
                      </div>
                      <p className="text-xs text-brand-muted">{p.brand || "Sin marca"} · {categoryLabel(p.categoryId)} · {p.barcode ?? "Sin código"}</p>
                      <p className="mt-0.5 text-xs text-brand-muted">
                        {reasons.length === 0 ? "Se muestra en el catálogo." : `No se muestra en el catálogo: ${reasons.join(" · ").toLowerCase()}.`}
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-semibold tabular-nums">
                      {valid.length === 0 ? <span className="text-xs font-normal text-brand-muted">Sin precio</span> : (
                        <>
                          {new Set(valid).size > 1 && <span className="mr-1 text-xs font-normal text-brand-muted">Desde</span>}
                          {formatPrice(Math.min(...valid))}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 sm:pl-[4.25rem]">
                    <LinkButton size="sm" icon="edit" href={`/panel/productos/${p.id}`} aria-label={`Editar ${p.name}`}>Editar</LinkButton>
                    {!p.archivedAt && (p.publishEnabled ? (
                      <Button size="sm" icon="eyeOff" disabled={busy} onClick={() => setPending({ product: p, kind: "unpublish" })} aria-label={`Despublicar ${p.name}`}>Despublicar</Button>
                    ) : (
                      <Button size="sm" icon="eye" disabled={busy || blockers.length > 0} title={blockers.join(" ")} onClick={() => void act(p, () => setPublished(db, p.id, true), `«${p.name}» publicado.`)} aria-label={`Publicar ${p.name}`}>Publicar</Button>
                    ))}
                    {p.archivedAt ? (
                      <Button size="sm" icon="archive" disabled={busy} onClick={() => void act(p, () => setArchived(db, p.id, false), `«${p.name}» desarchivado.`)} aria-label={`Desarchivar ${p.name}`}>Desarchivar</Button>
                    ) : (
                      <Button size="sm" icon="archive" disabled={busy} onClick={() => setPending({ product: p, kind: "archive" })} aria-label={`Archivar ${p.name}`}>Archivar</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
          <Button size="sm" icon="chevronLeft" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Anterior</Button>
          <p className="text-sm text-brand-muted tabular-nums">Página {page} de {pageCount}</p>
          <Button size="sm" disabled={page >= pageCount || loading} onClick={() => setPage(page + 1)}>Siguiente <Icon name="chevronRight" className="size-4" /></Button>
        </nav>
      )}


      <Dialog open={pending !== null} onClose={() => setPending(null)} title={pending?.kind === "archive" ? "¿Archivar este producto?" : "¿Despublicar este producto?"}>
        {pending && (
          <div className="space-y-4">
            <p className="text-sm text-brand-muted">
              {pending.kind === "archive"
                ? <>«{pending.product.name}» deja de mostrarse en el catálogo y se conserva con todos sus datos y fotos. Se puede desarchivar después.</>
                : <>«{pending.product.name}» deja de mostrarse en el catálogo, pero no se archiva ni se borra.</>}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = pending;
                  setPending(null);
                  void act(
                    target.product,
                    () => (target.kind === "archive" ? setArchived(db, target.product.id, true) : setPublished(db, target.product.id, false)),
                    target.kind === "archive" ? `«${target.product.name}» archivado.` : `«${target.product.name}» despublicado.`,
                  );
                }}
              >
                {pending.kind === "archive" ? "Archivar" : "Despublicar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Toaster toasts={toasts} />
    </>
  );
}
