"use client";

import { useState, type FormEvent } from "react";
import type { DemoCategory } from "@/lib/panel-demo/types";
import { useDemo } from "../demo-provider";
import { Button, CARD_CLASS, Dialog, EmptyState, Notice, PageHeader, SelectInput, TextInput } from "../ui";

/**
 * Las categorías son datos, no una lista fija: aquí se crean, renombran y eliminan igual que
 * se hará con las categorías dinámicas de Supabase. Eliminar una con productos exige
 * reasignarlos antes (como la función reassign_category_products de la base).
 */
export function CategoriesSection() {
  const { state, actions, notify } = useDemo();
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DemoCategory | null>(null);
  const [deleting, setDeleting] = useState<DemoCategory | null>(null);

  const countOf = (id: string) => state.products.filter((p) => p.categoryId === id).length;

  function add(e: FormEvent) {
    e.preventDefault();
    const error = actions.addCategory(name);
    setAddError(error);
    if (!error) {
      notify(`Categoría «${name.trim()}» creada (simulación).`);
      setName("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Categorías" subtitle="Organizá el catálogo con las categorías que necesite el negocio. Se pueden crear y cambiar en cualquier momento." />
      <Notice tone="demo">Los cambios de esta pantalla son una simulación y no se guardan.</Notice>

      <section className={`${CARD_CLASS} p-5`} aria-label="Nueva categoría">
        <form onSubmit={add} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <TextInput label="Nueva categoría" value={name} error={addError} placeholder="Ej.: Organización del hogar" onChange={(e) => { setName(e.target.value); setAddError(null); }} />
          </div>
          <Button type="submit" variant="primary" icon="plus" className="sm:mt-[1.625rem]">Crear categoría</Button>
        </form>
      </section>

      {state.categories.length === 0 ? (
        <EmptyState title="Todavía no hay categorías">Creá la primera para empezar a ordenar los productos.</EmptyState>
      ) : (
        <section className={CARD_CLASS} aria-label="Listado de categorías">
          <ul className="divide-y divide-brand-line">
            {state.categories.map((c) => {
              const n = countOf(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-brand-muted tabular-nums">{n === 1 ? "1 producto" : `${n} productos`}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" icon="edit" onClick={() => setRenaming(c)} aria-label={`Renombrar ${c.name}`}>Renombrar</Button>
                    <Button size="sm" icon="trash" onClick={() => setDeleting(c)} aria-label={`Eliminar ${c.name}`}>Eliminar</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RenameDialog category={renaming} onClose={() => setRenaming(null)} />
      <DeleteDialog category={deleting} count={deleting ? countOf(deleting.id) : 0} onClose={() => setDeleting(null)} />
    </div>
  );
}

function RenameDialog({ category, onClose }: { category: DemoCategory | null; onClose: () => void }) {
  return (
    <Dialog open={category !== null} onClose={onClose} title="Renombrar categoría">
      {category && <RenameForm key={category.id} category={category} onClose={onClose} />}
    </Dialog>
  );
}

function RenameForm({ category, onClose }: { category: DemoCategory; onClose: () => void }) {
  const { actions, notify } = useDemo();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const failure = actions.renameCategory(category.id, name);
    setError(failure);
    if (!failure) {
      notify("Categoría renombrada (simulación).");
      onClose();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextInput label="Nombre" value={name} error={error} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }} />
      <p className="text-xs text-brand-muted">Los productos de la categoría no se tocan: solo cambia el nombre que se muestra.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">Guardar</Button>
      </div>
    </form>
  );
}

function DeleteDialog({ category, count, onClose }: { category: DemoCategory | null; count: number; onClose: () => void }) {
  return (
    <Dialog open={category !== null} onClose={onClose} title="Eliminar categoría">
      {category && <DeleteForm key={category.id} category={category} count={count} onClose={onClose} />}
    </Dialog>
  );
}

function DeleteForm({ category, count, onClose }: { category: DemoCategory; count: number; onClose: () => void }) {
  const { state, actions, notify } = useDemo();
  const others = state.categories.filter((c) => c.id !== category.id);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const failure = actions.deleteCategory(category.id, count > 0 ? moveTo : null);
    setError(failure);
    if (!failure) {
      notify(`Categoría «${category.name}» eliminada (simulación).`);
      onClose();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {count === 0 ? (
        <p className="text-sm text-brand-muted">«{category.name}» no tiene productos. Se puede eliminar sin más.</p>
      ) : others.length === 0 ? (
        <Notice tone="warn">«{category.name}» tiene {count} productos y no hay otra categoría a la que pasarlos. Creá una antes de eliminarla.</Notice>
      ) : (
        <>
          <p className="text-sm text-brand-muted">
            «{category.name}» tiene {count === 1 ? "1 producto" : `${count} productos`}. No se pueden dejar sin categoría: elegí a cuál pasarlos.
          </p>
          <SelectInput label="Pasar los productos a" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} error={error}>
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
        </>
      )}
      {count === 0 && error && <p className="text-sm text-brand-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="danger" disabled={count > 0 && others.length === 0}>Eliminar</Button>
      </div>
    </form>
  );
}
