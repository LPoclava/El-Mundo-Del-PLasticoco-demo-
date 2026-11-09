"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { formatDate, formatDateTime } from "@/lib/panel/format";
import { ROLES, ROLE_LABEL, ROLE_SUMMARY, atLeast, type Role } from "@/lib/panel/roles";
import { changeActive, changeName, changeRole, giveAccess, listUsers } from "@/lib/users/admin";
import { canManage, validateDisplayName, type ManagedUser } from "@/lib/users/rules";
import { useSession } from "../auth-provider";
import { Badge, Button, CARD_CLASS, ConfirmDialog, Dialog, EmptyState, Notice, PageHeader, SelectInput, TextInput, Toaster } from "../ui";
import { useToasts } from "../use-toasts";

/**
 * Usuarios y permisos. Datos reales: admin_list_users() y las funciones admin_* de la base, que exigen CEO activo.
 * Las cuentas de Auth se crean a mano en Supabase; acá se les da acceso (perfil y rol), se cambia el rol, se
 * activa o desactiva y se corrige el nombre. La base impide cambiar el propio rol y dejar la app sin CEO.
 */
export function UsersSection() {
  const { profile } = useSession();
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Usuarios y permisos" subtitle="Quién puede entrar y qué puede hacer. Solo el CEO administra usuarios y roles." />
      {atLeast(profile.role, "ceo") ? (
        <Manager />
      ) : (
        <Notice tone="warn" title="Solo el CEO administra usuarios">Tu rol no incluye esta sección.</Notice>
      )}
    </div>
  );
}

type Confirm = { title: string; body: string; label: string; danger?: boolean; run: () => Promise<string | null> };

function Manager() {
  const { db, userId } = useSession();
  const { toasts, push } = useToasts();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [working, setWorking] = useState(false);
  const [renaming, setRenaming] = useState<ManagedUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    listUsers(db)
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "No se pudo cargar el equipo.");
      });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const reload = () => setVersion((v) => v + 1);

  async function run(action: () => Promise<string | null>, okMessage: string): Promise<boolean> {
    setWorking(true);
    const failure = await action();
    setWorking(false);
    if (failure) {
      push(failure, "error");
      return false;
    }
    push(okMessage);
    reload();
    return true;
  }

  async function confirmed() {
    if (!confirm) return;
    const ok = await run(confirm.run, "Cambio aplicado.");
    if (ok) setConfirm(null);
  }

  if (loadError && !users) {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="No se pudo cargar el equipo">{loadError}</Notice>
        <Button icon="refresh" onClick={reload}>Reintentar</Button>
      </div>
    );
  }
  if (!users) return <BrandLoader label="Cargando el equipo…" />;

  const withAccess = users.filter((u) => u.hasProfile);
  const without = users.filter((u) => !u.hasProfile);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section aria-label="Jerarquía de roles" className={`${CARD_CLASS} p-5`}>
        <h2 className="text-base font-semibold">Jerarquía de roles</h2>
        <p className="mt-0.5 text-sm text-brand-muted">Cada rol incluye lo del anterior.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <li key={r} className="rounded-lg bg-brand-cream p-4">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-brand-ink text-xs font-semibold text-white">{i + 1}</span>
                <p className="font-semibold">{ROLE_LABEL[r]}</p>
              </div>
              <p className="mt-2 text-sm text-brand-muted">{ROLE_SUMMARY[r]}</p>
            </li>
          ))}
        </ol>
      </section>

      {loadError && <Notice tone="warn" title="No se pudo actualizar la lista">{loadError}</Notice>}

      <section className={CARD_CLASS} aria-label="Personas con acceso">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-line px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold">Personas con acceso <span className="font-normal text-brand-muted">({withAccess.length})</span></h2>
          <Button size="sm" icon="refresh" onClick={reload}>Actualizar</Button>
        </div>
        {withAccess.length === 0 ? (
          <div className="p-4"><EmptyState title="Todavía no hay personas con acceso">Dales acceso desde la lista de cuentas sin acceso.</EmptyState></div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {withAccess.map((u) => {
              const can = canManage(userId, u);
              const self = u.userId === userId;
              const name = u.displayName ?? u.email;
              return (
                <li key={u.userId} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate font-medium">{name}{self && <span className="ml-2 text-xs font-normal text-brand-muted">(vos)</span>}</p>
                    <p className="truncate text-xs text-brand-muted">{u.email}</p>
                    <p className="mt-0.5 text-xs text-brand-muted tabular-nums">
                      Cuenta creada {formatDate(u.createdAt)} · {u.lastSignInAt ? `último ingreso ${formatDateTime(u.lastSignInAt)}` : "todavía no ingresó"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`rol-${u.userId}`}>Rol de {name}</label>
                    <select
                      id={`rol-${u.userId}`}
                      value={u.role ?? ""}
                      disabled={!can.changeRole || working}
                      onChange={(e) => {
                        const next = e.target.value as Role;
                        if (next === u.role) return;
                        setConfirm({
                          title: "Cambiar el rol",
                          body: `${name} pasará de ${ROLE_LABEL[u.role as Role]} a ${ROLE_LABEL[next]}. Cambia lo que puede ver y hacer desde su próximo ingreso.`,
                          label: "Cambiar rol",
                          run: () => changeRole(db, u.userId, next),
                        });
                      }}
                      className="h-11 rounded-lg border border-brand-line bg-white px-2 text-sm disabled:bg-brand-sand disabled:text-brand-muted"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    {u.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>}
                    <Button size="sm" disabled={!can.rename || working} onClick={() => setRenaming(u)} aria-label={`Cambiar el nombre de ${name}`}>Nombre</Button>
                    <Button
                      size="sm"
                      disabled={!can.toggleActive || working}
                      aria-label={`${u.active ? "Desactivar" : "Activar"} a ${name}`}
                      onClick={() =>
                        u.active
                          ? setConfirm({
                              title: "Desactivar usuario",
                              body: `${name} no podrá usar el panel ni vender hasta que lo actives de nuevo. No se borra nada.`,
                              label: "Desactivar",
                              danger: true,
                              run: () => changeActive(db, u.userId, false),
                            })
                          : void run(() => changeActive(db, u.userId, true), "Usuario activado.")
                      }
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={CARD_CLASS} aria-label="Cuentas sin acceso al panel">
        <div className="border-b border-brand-line px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold">Cuentas sin acceso <span className="font-normal text-brand-muted">({without.length})</span></h2>
          <p className="mt-0.5 text-sm text-brand-muted">
            Para sumar a una persona, creá primero su cuenta en Supabase (Authentication → Users). Después aparece acá para darle un rol.
          </p>
        </div>
        {without.length === 0 ? (
          <p className="px-4 py-4 text-sm text-brand-muted sm:px-5">No hay cuentas esperando acceso.</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {without.map((u) => (
              <GiveAccessRow key={u.userId} user={u} disabled={working} onGive={(name, role) => run(() => giveAccess(db, u.userId, name, role), "Acceso otorgado.")} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-brand-muted">
        Reglas que aplica la base de datos: nadie cambia su propio rol ni su estado, y no se puede dejar la aplicación sin un CEO activo.
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => !working && setConfirm(null)}
        onConfirm={() => void confirmed()}
        title={confirm?.title ?? ""}
        confirmLabel={working ? "Aplicando…" : (confirm?.label ?? "Confirmar")}
        danger={confirm?.danger}
      >
        {confirm?.body}
      </ConfirmDialog>

      <RenameDialog
        user={renaming}
        busy={working}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (!renaming) return;
          const ok = await run(() => changeName(db, renaming.userId, name), "Nombre actualizado.");
          if (ok) setRenaming(null);
        }}
      />

      <Toaster toasts={toasts} />
    </div>
  );
}

function GiveAccessRow({ user, disabled, onGive }: { user: ManagedUser; disabled: boolean; onGive: (name: string, role: Role) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("empleado");
  const [error, setError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateDisplayName(name);
    setError(invalid ?? undefined);
    if (invalid) return;
    await onGive(name, role);
  }

  return (
    <li className="px-4 py-3 sm:px-5">
      <p className="truncate text-sm font-medium">{user.email}</p>
      <p className="text-xs text-brand-muted tabular-nums">Cuenta creada {formatDate(user.createdAt)}</p>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={error} autoComplete="off" />
        <SelectInput label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </SelectInput>
        <Button type="submit" variant="primary" disabled={disabled}>Dar acceso</Button>
      </form>
    </li>
  );
}

function RenameDialog({ user, busy, onClose, onSave }: { user: ManagedUser | null; busy: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  return (
    <Dialog open={user !== null} onClose={onClose} title="Cambiar el nombre" description={user?.email}>
      {user && <RenameForm key={user.userId} initial={user.displayName ?? ""} busy={busy} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function RenameForm({ initial, busy, onClose, onSave }: { initial: string; busy: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const invalid = validateDisplayName(name);
        setError(invalid ?? undefined);
        if (!invalid) void onSave(name);
      }}
      className="space-y-4"
    >
      <TextInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>Guardar</Button>
      </div>
    </form>
  );
}
