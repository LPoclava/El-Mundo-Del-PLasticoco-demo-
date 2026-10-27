import type { Role } from "./roles";
import type { AuditEntry } from "./types";

/** Qué ve cada perfil en la auditoría de demostración (refleja las políticas reales). */
export function visibleAudit(audit: AuditEntry[], role: Role, userId: string): AuditEntry[] {
  if (role === "ceo") return audit;
  if (role === "gerente") return audit.filter((e) => e.scope === "catalogo");
  return audit.filter((e) => e.userId === userId);
}

export function describeEntry(e: AuditEntry): string {
  switch (e.action) {
    case "price": return `${e.userName} cambió el precio de «${e.target}»`;
    case "create": return `${e.userName} dio de alta «${e.target}»`;
    case "link": return `${e.userName} vinculó un código a «${e.target}»`;
    case "publish": return `${e.userName} publicó «${e.target}»`;
    case "unpublish": return `${e.userName} despublicó «${e.target}»`;
    case "archive": return `${e.userName} archivó «${e.target}»`;
    case "unarchive": return `${e.userName} desarchivó «${e.target}»`;
    case "edit": return `${e.userName} editó «${e.target}»`;
    case "category": return `${e.userName} modificó la categoría «${e.target}»`;
    case "user": return `${e.userName} cambió el acceso de ${e.target}`;
  }
}
