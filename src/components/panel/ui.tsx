"use client";

import {
  useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionOf, type IconName } from "@/lib/panel/roles";
import { Icon } from "./icons";

/** Piezas de interfaz del panel: botones, campos, insignias, diálogos y avisos. */

// ---- Botones ----

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT = {
  primary: "bg-brand-orange text-brand-ink hover:bg-brand-orange/85",
  secondary: "border border-brand-line bg-white hover:border-brand-ink",
  ghost: "hover:bg-brand-sand",
  danger: "border border-brand-danger bg-white text-brand-danger hover:bg-brand-danger hover:text-white",
  // Acciones del escáner: amarillo = registrar producto, verde = actualizar stock (naranja = vender).
  yellow: "bg-amber-300 text-brand-charcoal hover:bg-amber-300/85",
  green: "bg-brand-green text-white hover:bg-brand-green/90",
} as const;

// «sm» sigue siendo más compacto, pero nunca por debajo del área táctil mínima de 44 px.
const BUTTON_SIZE = { md: "h-11 px-4", sm: "h-11 px-3" } as const;

export function buttonClass(variant: keyof typeof BUTTON_VARIANT = "secondary", size: keyof typeof BUTTON_SIZE = "md") {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  icon?: IconName;
};

export function Button({ variant = "secondary", size = "md", icon, className = "", children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className = "", "aria-label": ariaLabel }: {
  href: string; variant?: keyof typeof BUTTON_VARIANT; size?: keyof typeof BUTTON_SIZE; icon?: IconName; children: ReactNode;
  className?: string; "aria-label"?: string;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`${buttonClass(variant, size)} ${className}`}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </Link>
  );
}

// ---- Campos ----

export const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:border-brand-ink aria-[invalid=true]:border-brand-danger disabled:bg-brand-sand disabled:text-brand-muted";

export function Field({ label, error, hint, children }: {
  label: string; error?: string | null; hint?: string; children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-brand-danger">
          <Icon name="alert" className="mt-0.5 size-4" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-brand-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, error, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string | null; hint?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS} {...rest} />
      )}
    </Field>
  );
}

export function SelectInput({ label, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string; error?: string | null;
}) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

// ---- Insignias ----

const BADGE_TONE = {
  ok: "bg-brand-green/10 text-brand-green-ink",
  warn: "bg-brand-orange/20 text-brand-ink",
  muted: "bg-brand-sand text-brand-muted",
  danger: "bg-brand-danger/10 text-brand-danger",
} as const;

export function Badge({ tone = "muted", children }: { tone?: keyof typeof BADGE_TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

// ---- Avisos ----

export function Notice({ tone = "info", title, children, action }: {
  tone?: "info" | "warn"; title?: string; children: ReactNode; action?: ReactNode;
}) {
  const style = tone === "warn" ? "border-brand-danger/30 bg-brand-danger/5" : "border-brand-line bg-brand-sand";
  return (
    <div role="note" className={`flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 text-sm ${style}`}>
      <Icon name={tone === "warn" ? "alert" : "info"} className="mt-0.5 size-4" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? "mt-0.5 text-brand-muted" : ""}>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-line bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-brand-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Encabezado de una pantalla del panel. `back` es para las pantallas internas (crear, editar): lleva a la
 * pantalla de la que se vino, así cada operación completa tiene su propia página y no un modal.
 */
export function PageHeader({ title, subtitle, actions, back, icon }: {
  title: string; subtitle?: string; actions?: ReactNode; back?: { href: string; label: string }; icon?: IconName;
}) {
  // Sin ícono explícito se toma el de la sección a la que pertenece la dirección (también en pantallas internas).
  const pathname = usePathname();
  const iconName = icon ?? sectionOf(pathname)?.icon;
  return (
    <header className="border-b border-brand-line pb-3 sm:pb-4">
      {back && (
        <nav aria-label="Ubicación" className="-mt-1 flex flex-wrap items-center text-sm text-brand-muted sm:mb-1 sm:mt-0">
          <Link href={back.href} className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 font-medium hover:text-brand-ink">
            <Icon name="chevronLeft" className="size-4" />
            {back.label}
          </Link>
          <span aria-hidden className="px-1">/</span>
          <span aria-current="page" className="text-brand-ink">{title}</span>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {iconName && (
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green-ink sm:size-11">
              <Icon name={iconName} className="size-5 sm:size-6" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-balance sm:text-2xl">{title}</h1>
            {subtitle && <p className="max-w-2xl text-sm leading-snug text-brand-muted sm:mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export const CARD_CLASS = "rounded-xl border border-brand-line bg-white";

// ---- Diálogo (usa <dialog>: foco atrapado y Escape nativos) ----

/**
 * Solo para confirmaciones, alertas y acciones secundarias (archivar, eliminar, vaciar). Una funcionalidad
 * completa (crear, editar, vender) va en su propia pantalla, no acá: ese es el estándar Full Page del panel.
 */
export function Dialog({ open, onClose, title, description, children }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const position = "m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] rounded-xl";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`${position} overflow-y-auto border border-brand-line bg-white p-0 text-brand-ink shadow-xl backdrop:bg-brand-ink/40`}
    >
      {open && (
        <div className="flex min-h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-brand-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-brand-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 inline-flex size-10 items-center justify-center rounded-lg hover:bg-brand-sand">
              <Icon name="x" />
            </button>
          </div>
          <div className="flex-1 px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, danger = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel: string; danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-sm text-brand-muted">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

// ---- Avisos emergentes ----

export type ToastTone = "ok" | "error";
export type Toast = { id: number; message: string; tone: ToastTone };

export function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <p
          key={t.id}
          className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg ${t.tone === "error" ? "bg-brand-danger text-white" : "bg-brand-ink text-white"}`}
        >
          <Icon name={t.tone === "error" ? "alert" : "check"} className="size-4" />
          {t.message}
        </p>
      ))}
    </div>
  );
}

// ---- Miniatura de producto (marcador para cuando el producto no tiene foto) ----

const TONES = ["bg-brand-orange/15 text-brand-ink", "bg-brand-green/15 text-brand-green-ink", "bg-brand-sand text-brand-muted"];

export function ProductThumb({ seed, className = "size-12" }: { seed: string; className?: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg ${TONES[h % TONES.length]} ${className}`}>
      <Icon name="box" className="size-1/2" />
    </span>
  );
}
