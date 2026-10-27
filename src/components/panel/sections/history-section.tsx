"use client";

import { useMemo, useState } from "react";
import { visibleAudit } from "@/lib/panel-demo/audit";
import { ACTION_LABEL, formatDateTime, toDayKey } from "@/lib/panel-demo/format";
import { ROLE_LABEL, historyTitle } from "@/lib/panel-demo/roles";
import type { AuditAction } from "@/lib/panel-demo/types";
import { useDemo } from "../demo-provider";
import { Badge, Button, CARD_CLASS, DemoBadge, EmptyState, INPUT_CLASS, Notice, PageHeader } from "../ui";

/** Auditoría de DEMOSTRACIÓN. La auditoría real vive en la tabla audit_log de Supabase. */
export function HistorySection() {
  const { state, role, actor } = useDemo();
  const [user, setUser] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const scoped = useMemo(() => (role && actor ? visibleAudit(state.audit, role, actor.id) : []), [state.audit, role, actor]);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    scoped.forEach((e) => map.set(e.userId, e.userName));
    return [...map.entries()];
  }, [scoped]);

  const actions = useMemo(() => [...new Set(scoped.map((e) => e.action))], [scoped]);

  const rows = scoped.filter((e) => {
    if (user && e.userId !== user) return false;
    if (action && e.action !== action) return false;
    const day = toDayKey(e.at);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  if (!role) return null;
  const hasFilters = Boolean(user || action || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        title={historyTitle(role)}
        subtitle={
          role === "empleado" ? "Tus propias operaciones: precios, códigos y altas."
          : role === "gerente" ? "Cambios del catálogo realizados por todo el equipo."
          : "Todos los cambios del sistema, incluidos usuarios y roles."
        }
        actions={<DemoBadge>Registros ficticios</DemoBadge>}
      />

      <Notice tone="info">
        Estos registros son de ejemplo y no son la auditoría real. La real guardará quién, qué, cuándo y los valores anteriores y nuevos, y nadie podrá editarla.
      </Notice>

      <section className={`${CARD_CLASS} p-4`} aria-label="Filtros">
        <div className={`grid gap-3 ${role === "empleado" ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
          {role !== "empleado" && (
            <div>
              <label htmlFor="h-user" className="mb-1.5 block text-sm font-medium">Usuario</label>
              <select id="h-user" value={user} onChange={(e) => setUser(e.target.value)} className={INPUT_CLASS}>
                <option value="">Todos</option>
                {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="h-action" className="mb-1.5 block text-sm font-medium">Operación</label>
            <select id="h-action" value={action} onChange={(e) => setAction(e.target.value as AuditAction | "")} className={INPUT_CLASS}>
              <option value="">Todas</option>
              {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="h-from" className="mb-1.5 block text-sm font-medium">Desde</label>
            <input id="h-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="h-to" className="mb-1.5 block text-sm font-medium">Hasta</label>
            <input id="h-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
      </section>

      <p className="text-sm text-brand-muted" aria-live="polite">
        {rows.length === 1 ? "1 registro" : `${rows.length} registros`}
        {hasFilters && (
          <>
            {" · "}
            <button type="button" className="font-medium text-brand-ink underline underline-offset-4" onClick={() => { setUser(""); setAction(""); setFrom(""); setTo(""); }}>Quitar filtros</button>
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="Sin registros" action={hasFilters ? <Button onClick={() => { setUser(""); setAction(""); setFrom(""); setTo(""); }}>Quitar filtros</Button> : undefined}>
          {hasFilters ? "Ningún movimiento coincide con esos filtros." : "Los cambios que hagas en la demo aparecen acá."}
        </EmptyState>
      ) : (
        <>
          <div className={`${CARD_CLASS} hidden overflow-x-auto md:block`}>
            <table className="w-full text-sm">
              <caption className="sr-only">Registros de cambios de demostración</caption>
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Fecha y hora</th>
                  <th scope="col" className="px-3 py-3 font-medium">Usuario</th>
                  <th scope="col" className="px-3 py-3 font-medium">Acción</th>
                  <th scope="col" className="px-3 py-3 font-medium">Afectado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Antes → después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-brand-muted">{formatDateTime(e.at)}</td>
                    <td className="px-3 py-3"><span className="block">{e.userName}</span><Badge>{ROLE_LABEL[e.role]}</Badge></td>
                    <td className="px-3 py-3">{ACTION_LABEL[e.action]}</td>
                    <td className="px-3 py-3">{e.target}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.from || e.to ? (
                        <>
                          {e.from && <span className="text-brand-muted">{e.from}</span>}
                          {e.from && e.to && <span aria-hidden className="mx-1.5 text-brand-muted">→</span>}
                          {e.to && <span className="font-medium">{e.to}</span>}
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((e) => (
              <li key={e.id} className={`${CARD_CLASS} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{ACTION_LABEL[e.action]}</p>
                  <p className="shrink-0 text-xs tabular-nums text-brand-muted">{formatDateTime(e.at)}</p>
                </div>
                <p className="mt-1 text-sm">{e.target}</p>
                {(e.from || e.to) && (
                  <p className="mt-1 text-sm tabular-nums">
                    {e.from && <span className="text-brand-muted">{e.from}</span>}
                    {e.from && e.to && <span aria-hidden className="mx-1.5 text-brand-muted">→</span>}
                    {e.to && <span className="font-medium">{e.to}</span>}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-2 text-xs text-brand-muted">{e.userName} <Badge>{ROLE_LABEL[e.role]}</Badge></p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
