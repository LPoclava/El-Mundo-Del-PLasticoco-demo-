"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatDate } from "@/lib/panel-demo/format";
import { ROLES, ROLE_LABEL, ROLE_SUMMARY, type Role } from "@/lib/panel-demo/roles";
import { useDemo } from "../demo-provider";
import { Badge, Button, CARD_CLASS, DemoBadge, LinkButton, Notice, PageHeader, SelectInput, TextInput } from "../ui";

/**
 * Usuarios y permisos de DEMOSTRACIÓN. No crea cuentas ni toca Supabase Auth. Reproduce las reglas
 * de la base real: nadie cambia su propio rol y no se puede dejar la app sin un CEO activo.
 */
export function UsersSection() {
  const { state, actor, actions, notify } = useDemo();
  const [error, setError] = useState<string | null>(null);

  function setRole(id: string, role: Role) {
    const failure = actions.setUserRole(id, role);
    setError(failure);
    if (!failure) notify("Rol actualizado (simulación).");
  }

  function setActive(id: string, value: boolean) {
    const failure = actions.setUserActive(id, value);
    setError(failure);
    if (!failure) notify(value ? "Usuario activado (simulación)." : "Usuario desactivado (simulación).");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Quién puede entrar y qué puede hacer. Solo el CEO administra usuarios y roles."
        actions={<><DemoBadge>Usuarios ficticios</DemoBadge><LinkButton href="/panel/usuarios/nuevo" variant="primary" icon="plus">Nuevo usuario</LinkButton></>}
      />

      <section aria-label="Jerarquía de roles" className={`${CARD_CLASS} p-5`}>
        <h2 className="text-base font-semibold">Jerarquía de roles</h2>
        <p className="mt-0.5 text-sm text-brand-muted">Cada rol incluye lo del anterior.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <li key={r} className="rounded-lg bg-brand-cream p-4" style={{ marginInlineStart: `${i * 0}px` }}>
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-brand-ink text-xs font-semibold text-white">{i + 1}</span>
                <p className="font-semibold">{ROLE_LABEL[r]}</p>
              </div>
              <p className="mt-2 text-sm text-brand-muted">{ROLE_SUMMARY[r]}</p>
            </li>
          ))}
        </ol>
      </section>

      {error && <Notice tone="warn" title="No se pudo aplicar el cambio">{error}</Notice>}

      <section className={`${CARD_CLASS} overflow-x-auto`} aria-label="Listado de usuarios">
        <table className="hidden w-full text-sm md:table">
          <caption className="sr-only">Usuarios de demostración</caption>
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-muted">
              <th scope="col" className="px-5 py-3 font-medium">Nombre y correo</th>
              <th scope="col" className="px-3 py-3 font-medium">Rol</th>
              <th scope="col" className="px-3 py-3 font-medium">Estado</th>
              <th scope="col" className="px-3 py-3 font-medium">Alta</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {state.users.map((u) => {
              const self = u.id === actor?.id;
              return (
                <tr key={u.id}>
                  <td className="px-5 py-3"><span className="block font-medium">{u.name}{self && <span className="ml-2 text-xs font-normal text-brand-muted">(vos)</span>}</span><span className="block text-xs text-brand-muted">{u.email}</span></td>
                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`rol-${u.id}`}>Rol de {u.name}</label>
                    <select id={`rol-${u.id}`} value={u.role} disabled={self} onChange={(e) => setRole(u.id, e.target.value as Role)} className="h-11 rounded-lg border border-brand-line bg-white px-2 text-sm disabled:bg-brand-sand disabled:text-brand-muted">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">{u.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-brand-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" disabled={self} onClick={() => setActive(u.id, !u.active)} aria-label={`${u.active ? "Desactivar" : "Activar"} a ${u.name}`}>
                      {u.active ? "Desactivar" : "Activar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ul className="divide-y divide-brand-line md:hidden">
          {state.users.map((u) => {
            const self = u.id === actor?.id;
            return (
              <li key={u.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}{self && <span className="ml-2 text-xs font-normal text-brand-muted">(vos)</span>}</p>
                    <p className="truncate text-xs text-brand-muted">{u.email}</p>
                  </div>
                  {u.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`rolm-${u.id}`}>Rol de {u.name}</label>
                  <select id={`rolm-${u.id}`} value={u.role} disabled={self} onChange={(e) => setRole(u.id, e.target.value as Role)} className="h-11 flex-1 rounded-lg border border-brand-line bg-white px-2 text-sm disabled:bg-brand-sand disabled:text-brand-muted">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <Button size="sm" disabled={self} onClick={() => setActive(u.id, !u.active)}>{u.active ? "Desactivar" : "Activar"}</Button>
                </div>
                <p className="text-xs text-brand-muted tabular-nums">Alta: {formatDate(u.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-brand-muted">
        Reglas que ya aplica el sistema real: nadie cambia su propio rol, y no se puede dejar la aplicación sin un CEO activo.
      </p>

    </div>
  );
}

/** Alta de un usuario de demostración en su propia pantalla (/panel/usuarios/nuevo). */
export function NewUserScreen() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/panel/usuarios", label: "Usuarios y permisos" }} title="Nuevo usuario" subtitle="Simulación: no se crea ninguna cuenta real." />
      <div className={`${CARD_CLASS} max-w-xl p-4 sm:p-6`}>
        <NewUserForm onClose={() => router.push("/panel/usuarios")} />
      </div>
    </div>
  );
}

function NewUserForm({ onClose }: { onClose: () => void }) {
  const { actions, notify } = useDemo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("empleado");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const failure = actions.addUser({ name, email, role });
    setError(failure);
    if (!failure) {
      notify("Usuario de demostración creado.");
      onClose();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextInput label="Nombre" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <TextInput label="Correo (ficticio)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ejemplo.test" />
      <SelectInput label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </SelectInput>
      {error && <p className="text-sm text-brand-danger">{error}</p>}
      <p className="text-xs text-brand-muted">En el sistema definitivo, la cuenta se crea primero y después se le asigna el perfil con su rol.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary">Crear usuario</Button>
      </div>
    </form>
  );
}
