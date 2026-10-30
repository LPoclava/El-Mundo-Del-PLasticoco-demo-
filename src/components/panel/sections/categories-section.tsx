"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareImage } from "@/lib/banners/image";
import { CATEGORY_RECOMMENDED_SIZE } from "@/lib/banners/rules";
import {
  CATEGORY_DESCRIPTION_MAX, changeCategoryImage, deleteCategory, listAllCategories, reorderMainCategories, updateCategory,
  type AdminCategoryRow,
} from "@/lib/categories/admin";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { SupabaseGate } from "../supabase-gate";
import { useToasts } from "../use-toasts";
import { Badge, Button, CARD_CLASS, Dialog, Field, Notice, PageHeader, SelectInput, TextInput, Toaster } from "../ui";

/**
 * Categorías REALES (Supabase). Las cuatro principales (Cocina, Baño, Librería, Regalería) se editan,
 * se ordenan y se activan o desactivan. Eliminar exige pasar sus productos a otra categoría: la base
 * no permite dejar productos sin clasificar. Las subcategorías existentes se muestran y no se tocan solas.
 */
export function CategoriesSection() {
  return (
    <div className="space-y-6">
      <PageHeader title="Categorías" subtitle="Las cuatro categorías principales del catálogo: nombre, descripción, foto, orden y visibilidad." />
      {isBrowserSupabaseConfigured ? (
        <SupabaseGate action="administrar categorías">{(db) => <Manager db={db} />}</SupabaseGate>
      ) : (
        <Notice tone="warn" title="Supabase no está configurado">Faltan las variables del proyecto. Sin ellas no se pueden leer ni guardar categorías.</Notice>
      )}
    </div>
  );
}

function Manager({ db }: { db: SupabaseClient }) {
  const { toasts, push } = useToasts();
  const [rows, setRows] = useState<AdminCategoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<AdminCategoryRow | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAllCategories(db)
      .then((r) => { if (!cancelled) { setRows(r); setError(null); } })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "No se pudieron leer las categorías."));
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const reload = () => setVersion((v) => v + 1);

  if (error) return <Notice tone="warn" title="No se pudieron cargar las categorías">{error}</Notice>;
  if (!rows) return <p role="status" className="text-sm text-brand-muted">Cargando categorías…</p>;

  const main = rows.filter((r) => r.featuredPosition !== null).sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0));
  const others = rows.filter((r) => r.featuredPosition === null);
  const nameOf = (id: string | null) => rows.find((r) => r.id === id)?.name ?? "";

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      push(ok);
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo completar la operación.", "error");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const ids = main.map((m) => m.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => reorderMainCategories(db, ids), "Orden actualizado.");
  }

  return (
    <>
      <section className={CARD_CLASS} aria-labelledby="principales">
        <div className="border-b border-brand-line px-5 py-3">
          <h2 id="principales" className="text-base font-semibold">Categorías principales</h2>
          <p className="text-sm text-brand-muted">El orden de esta lista es el de las tarjetas del catálogo.</p>
        </div>
        <ol className="divide-y divide-brand-line">
          {main.map((c, i) => (
            <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-sand text-brand-muted">
                  {c.imagePath ? <Image src={productImageUrl(c.imagePath)} alt={`Foto de ${c.name}`} fill sizes="64px" className="object-cover" /> : <Icon name="image" className="size-6" />}
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.name}
                    {c.active ? <Badge tone="ok">Visible</Badge> : <Badge>Oculta</Badge>}
                  </p>
                  <p className="text-sm text-brand-muted">{c.description ?? "Sin descripción"}</p>
                  <p className="text-xs tabular-nums text-brand-muted">
                    {c.productCount === 1 ? "1 producto" : `${c.productCount} productos`}{c.childCount ? ` · ${c.childCount === 1 ? "1 subcategoría" : `${c.childCount} subcategorías`}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${c.name}`}><Icon name="chevronDown" className="size-4 rotate-180" /></Button>
                <Button size="sm" disabled={busy || i === main.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${c.name}`}><Icon name="chevronDown" className="size-4" /></Button>
                <Button size="sm" icon="edit" disabled={busy} onClick={() => setEditing(c)}>Editar</Button>
                <Button size="sm" disabled={busy} aria-pressed={!c.active} onClick={() => void run(() => updateCategory(db, c.id, { name: c.name, description: c.description, active: !c.active }), c.active ? `«${c.name}» quedó oculta en el catálogo.` : `«${c.name}» vuelve a verse en el catálogo.`)}>
                  {c.active ? "Ocultar" : "Mostrar"}
                </Button>
                <Button size="sm" icon="trash" disabled={busy} onClick={() => setDeleting(c)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {others.length > 0 && (
        <section className={CARD_CLASS} aria-labelledby="otras">
          <div className="border-b border-brand-line px-5 py-3">
            <h2 id="otras" className="text-base font-semibold">Subcategorías y otras categorías</h2>
            <p className="text-sm text-brand-muted">Se conservan como están. Sus productos no se mueven solos.</p>
          </div>
          <ul className="divide-y divide-brand-line">
            {others.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-brand-muted">
                    {c.parentId ? `Dentro de ${nameOf(c.parentId)}` : "Sin categoría principal"} · {c.productCount === 1 ? "1 producto" : `${c.productCount} productos`}
                  </p>
                </div>
                <Button size="sm" icon="edit" disabled={busy} onClick={() => setEditing(c)}>Editar</Button>
                <Button size="sm" icon="trash" disabled={busy} onClick={() => setDeleting(c)}>Eliminar</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Editar categoría">
        {editing && (
          <EditForm
            key={editing.id} db={db} category={editing} onClose={() => setEditing(null)}
            onSaved={(m) => { push(m); reload(); }} onError={(m) => push(m, "error")}
          />
        )}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Eliminar categoría">
        {deleting && (
          <DeleteForm
            key={deleting.id} db={db} category={deleting} options={rows.filter((r) => r.id !== deleting.id && r.parentId !== deleting.id)}
            onClose={() => setDeleting(null)} onDone={(m) => { setDeleting(null); push(m); reload(); }} onError={(m) => push(m, "error")}
          />
        )}
      </Dialog>

      <Toaster toasts={toasts} />
    </>
  );
}

function EditForm({ db, category, onClose, onSaved, onError }: {
  db: SupabaseClient; category: AdminCategoryRow; onClose: () => void; onSaved: (m: string) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [active, setActive] = useState(category.active);
  const [imagePath, setImagePath] = useState(category.imagePath);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isMain = category.featuredPosition !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Escribí un nombre.");
    if (description.trim().length > CATEGORY_DESCRIPTION_MAX) return setError(`La descripción tiene un máximo de ${CATEGORY_DESCRIPTION_MAX} caracteres.`);
    setBusy(true);
    try {
      await updateCategory(db, category.id, { name: name.trim(), description: description.trim() || null, active });
      onSaved("Categoría guardada.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  async function photo(file: File | undefined | null) {
    setBusy(true);
    try {
      const image = file ? await prepareImage(file, "category") : null;
      await changeCategoryImage(db, { ...category, imagePath }, image);
      if (image) URL.revokeObjectURL(image.previewUrl);
      setImagePath(image ? "actualizada" : null);
      onSaved(image ? "Foto actualizada." : "Foto quitada: la tarjeta muestra un ícono.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo cambiar la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextInput label="Nombre" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setError(null); }} />
      <TextInput label="Descripción (opcional)" value={description} maxLength={CATEGORY_DESCRIPTION_MAX} hint="Se muestra en el catálogo al elegir esta categoría." onChange={(e) => { setDescription(e.target.value); setError(null); }} />
      {isMain && (
        <Field label="Foto de la tarjeta" hint={`Una foto sin texto escrito, apenas apaisada (unos ${CATEGORY_RECOMMENDED_SIZE}). Todas con el mismo encuadre.`}>
          {({ id, describedBy }) => (
            <div className="flex flex-wrap items-center gap-2">
              <input id={id} aria-describedby={describedBy} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = ""; }}
                className="block w-full text-sm file:mr-3 file:h-11 file:cursor-pointer file:rounded-lg file:border file:border-brand-line file:bg-white file:px-4 file:text-sm file:font-medium" />
              {imagePath && <Button size="sm" disabled={busy} onClick={() => void photo(null)}>Quitar la foto</Button>}
            </div>
          )}
        </Field>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-brand-green" />
        Mostrar en el catálogo
      </label>
      {error && <p role="alert" className="text-sm text-brand-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>Guardar</Button>
      </div>
    </form>
  );
}

function DeleteForm({ db, category, options, onClose, onDone, onError }: {
  db: SupabaseClient; category: AdminCategoryRow; options: AdminCategoryRow[]; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [target, setTarget] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const blocked = category.childCount > 0;
  const needsTarget = category.productCount > 0;

  async function confirm() {
    setBusy(true);
    try {
      const moved = await deleteCategory(db, category.id, needsTarget ? target : null);
      onDone(moved > 0 ? `Se pasaron ${moved} productos y se eliminó «${category.name}».` : `Se eliminó «${category.name}».`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo eliminar.");
      setBusy(false);
    }
  }

  if (blocked) {
    return (
      <div className="space-y-4">
        <Notice tone="warn">«{category.name}» tiene {category.childCount === 1 ? "una subcategoría" : `${category.childCount} subcategorías`}. Movelas o eliminalas antes.</Notice>
        <div className="flex justify-end"><Button onClick={onClose}>Entendido</Button></div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {needsTarget ? (
        <>
          <p className="text-sm text-brand-muted">
            «{category.name}» tiene {category.productCount === 1 ? "1 producto" : `${category.productCount} productos`}. Ningún producto puede quedar sin
            categoría: elegí a cuál pasarlos.
          </p>
          <SelectInput label="Pasar los productos a" value={target} onChange={(e) => setTarget(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </SelectInput>
        </>
      ) : (
        <p className="text-sm text-brand-muted">«{category.name}» no tiene productos. Se puede eliminar.</p>
      )}
      {category.featuredPosition !== null && (
        <Notice tone="warn">Es una de las categorías principales: su tarjeta desaparece del catálogo. Si solo querés ocultarla por un tiempo, usá «Ocultar».</Notice>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="danger" disabled={busy || (needsTarget && !target)} onClick={() => void confirm()}>Eliminar</Button>
      </div>
    </div>
  );
}
