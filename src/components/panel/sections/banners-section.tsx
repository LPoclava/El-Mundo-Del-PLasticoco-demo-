"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLoader } from "@/components/brand-loader";
import { PromoCarousel } from "@/components/catalog/promo-carousel";
import { withTimeout } from "@/lib/async";
import {
  createBanner, deleteBanner, listBanners, listMainCategories, reorderBanners,
  setBannerActive, updateBanner, type AdminBanner, type AdminCategory, type BannerInput,
} from "@/lib/banners/admin";
import { prepareImage, type PreparedImage } from "@/lib/banners/image";
import {
  BANNER_LIMITS, BANNER_RECOMMENDED_SIZE, STATUS_LABEL, bannerStatus, fromLocalInput,
  toLocalInput, validateBannerForm, type BannerFormErrors, type BannerStatus,
} from "@/lib/banners/rules";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { friendlyError } from "@/lib/supabase/errors";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { setFlash, takeFlash } from "../flash";
import { SupabaseGate } from "../supabase-gate";
import { useToasts } from "../use-toasts";
import {
  Badge, Button, CARD_CLASS, Dialog, EmptyState, Field, INPUT_CLASS, LinkButton, Notice, PageHeader, TextInput,
  Toaster,
} from "../ui";

/**
 * Banners promocionales con sesión REAL de Supabase (no la del panel de demostración).
 * Qué puede hacer cada persona lo decide la base: RLS exige rol gerente o superior en
 * public.profiles. Los botones ocultos o deshabilitados de esta pantalla son comodidad, no seguridad.
 */
export function BannersSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Banners promocionales"
        subtitle="Las imágenes del carrusel «Promociones y combos» del catálogo. Cargalas, ordenalas y programá cuándo se muestran."
      />
      {isBrowserSupabaseConfigured ? (
        <SupabaseGate action="administrar banners">{(db) => <Manager db={db} />}</SupabaseGate>
      ) : (
        <Notice tone="warn" title="Falta configurar la conexión">
          Sin la conexión con la base de datos no se puede leer ni guardar nada acá. Avisá a quien administra el sistema.
        </Notice>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pantalla de edición

const LOAD_TIMEOUT_MS = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Alta o edición de un banner en su propia pantalla (no un modal): la vista previa tiene todo el ancho y la
 * dirección se puede recargar. bannerId null = banner nuevo.
 */
export function BannerEditor({ bannerId }: { bannerId: string | null }) {
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/panel/banners", label: "Banners promocionales" }}
        title={bannerId ? "Editar banner" : "Nuevo banner"}
        subtitle="Lo que ves en la vista previa es lo que va a ver el cliente."
      />
      {!isBrowserSupabaseConfigured ? (
        <Notice tone="warn" title="Falta configurar la conexión">
          Sin la conexión con la base de datos no se puede leer ni guardar nada acá. Avisá a quien administra el sistema.
        </Notice>
      ) : bannerId !== null && !UUID.test(bannerId) ? (
        <MissingBanner />
      ) : (
        <SupabaseGate action="administrar banners">{(db) => <EditorData key={bannerId ?? "new"} db={db} bannerId={bannerId} />}</SupabaseGate>
      )}
    </div>
  );
}

/** Lee el id de la dirección (/panel/banners/[id]) en el navegador, donde vive la sesión. */
export function EditBannerRoute() {
  const { id } = useParams<{ id: string }>();
  return <BannerEditor bannerId={id ?? ""} />;
}

function MissingBanner() {
  return (
    <div className="space-y-3">
      <Notice tone="warn" title="Ese banner no existe">Puede que lo hayan eliminado o que la dirección esté incompleta.</Notice>
      <LinkButton href="/panel/banners">Volver a banners</LinkButton>
    </div>
  );
}

type Loaded = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; banners: AdminBanner[] };

function EditorData({ db, bannerId }: { db: SupabaseClient; bannerId: string | null }) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  // El listado da el banner a editar y la posición del próximo banner nuevo.
  useEffect(() => {
    let cancelled = false;
    withTimeout(listBanners(db), LOAD_TIMEOUT_MS)
      .then((banners) => !cancelled && setLoaded({ state: "ready", banners }))
      .catch((e: unknown) => !cancelled && setLoaded({ state: "error", message: e instanceof Error ? e.message : friendlyError(null) }));
    return () => {
      cancelled = true;
    };
  }, [db, attempt]);

  if (loaded.state === "loading") return <BrandLoader label={bannerId ? "Cargando el banner…" : "Preparando el formulario…"} />;
  if (loaded.state === "error") {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="No se pudo abrir el banner">{loaded.message}</Notice>
        <div className="flex flex-wrap gap-2">
          <Button
            icon="refresh"
            onClick={() => {
              setLoaded({ state: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
          <LinkButton href="/panel/banners">Volver a banners</LinkButton>
        </div>
      </div>
    );
  }
  const banner = bannerId ? (loaded.banners.find((b) => b.id === bannerId.toLowerCase()) ?? null) : null;
  if (bannerId && !banner) return <MissingBanner />;
  return (
    <div className={`${CARD_CLASS} max-w-4xl p-4 sm:p-6`}>
      <BannerForm
        db={db}
        banner={banner}
        nextPosition={Math.max(0, ...loaded.banners.map((b) => b.position)) + 1}
        onCancel={() => router.push("/panel/banners")}
        onSaved={async (message) => {
          setFlash({ message, tone: "ok" });
          router.push("/panel/banners");
        }}
        onError={(message) => push(message, "error")}
      />
      <Toaster toasts={toasts} />
    </div>
  );
}

// ---------------------------------------------------------------- administrador

const clean = (v: string) => v.trim() || null;

function Manager({ db }: { db: SupabaseClient }) {
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [now, setNow] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toasts, push } = useToasts();

  // Aviso de la pantalla de edición («Banner creado…»): se muestra al volver al listado.
  useEffect(() => {
    const flash = takeFlash();
    if (flash) push(flash.message, flash.tone);
  }, [push]);

  const reload = useCallback(async () => {
    try {
      const list = await listBanners(db);
      setBanners(list);
      setNow(Date.now());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : friendlyError(null));
    }
  }, [db]);

  // Carga inicial: el setState ocurre dentro de la promesa, no en el cuerpo del efecto.
  useEffect(() => {
    let cancelled = false;
    listBanners(db)
      .then((list) => {
        if (cancelled) return;
        setBanners(list);
        setNow(Date.now());
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : friendlyError(null));
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  async function run(id: string, action: () => Promise<void>, ok: string) {
    setBusyId(id);
    try {
      await action();
      await reload();
      push(ok);
    } catch (e) {
      push(e instanceof Error ? e.message : friendlyError(null), "error");
    } finally {
      setBusyId(null);
    }
  }

  function move(index: number, delta: -1 | 1) {
    if (!banners) return;
    const ids = banners.map((b) => b.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(banners[index].id, () => reorderBanners(db, ids), "Orden actualizado.");
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="No se pudieron cargar los banners">{loadError}</Notice>
        <Button onClick={() => void reload()}>Reintentar</Button>
      </div>
    );
  }
  if (!banners) return <BrandLoader label="Cargando banners…" />;

  const activeCount = banners.filter((b) => bannerStatus(b, now) === "active").length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-muted" aria-live="polite">
          {banners.length === 0 ? "Todavía no hay banners." : `${activeCount} en el catálogo ahora · ${banners.length} en total`}
        </p>
        <LinkButton href="/panel/banners/nuevo" variant="primary" icon="plus">Nuevo banner</LinkButton>
      </div>

      {banners.length === 0 ? (
        <EmptyState title="El catálogo no muestra promociones" action={<LinkButton href="/panel/banners/nuevo" variant="primary" icon="plus">Crear el primer banner</LinkButton>}>
          Mientras no haya banners activos, la sección «Promociones y combos» no aparece en el catálogo.
        </EmptyState>
      ) : (
        <section className={CARD_CLASS} aria-label="Listado de banners">
          <ol className="divide-y divide-brand-line">
            {banners.map((b, i) => (
              <BannerRow
                key={b.id}
                banner={b}
                position={i + 1}
                total={banners.length}
                status={bannerStatus(b, now)}
                busy={busyId === b.id}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onToggle={() => run(b.id, () => setBannerActive(db, b.id, !b.isActive), b.isActive ? "Banner desactivado." : "Banner activado.")}
                editHref={`/panel/banners/${b.id}`}
                onDelete={() => setDeleting(b)}
              />
            ))}
          </ol>
        </section>
      )}

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Eliminar banner">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-brand-muted">
              Se va a eliminar «{deleting.title ?? "Banner sin título"}» y su imagen. Esta acción no se puede deshacer. Si solo
              querés sacarlo del catálogo por un tiempo, desactivalo.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = deleting;
                  setDeleting(null);
                  void (async () => {
                    setBusyId(target.id);
                    try {
                      const { fileKept } = await deleteBanner(db, target);
                      await reload();
                      push(fileKept ? "Banner eliminado. Quedó un archivo suelto en Storage que se puede borrar a mano." : "Banner eliminado.");
                    } catch (e) {
                      push(e instanceof Error ? e.message : friendlyError(null), "error");
                    } finally {
                      setBusyId(null);
                    }
                  })();
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Toaster toasts={toasts} />
    </>
  );
}

const STATUS_TONE: Record<BannerStatus, "ok" | "warn" | "danger" | "muted"> = {
  active: "ok", scheduled: "warn", expired: "danger", inactive: "muted",
};

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function schedule(b: AdminBanner): string | null {
  const fmt = (iso: string) => dateFormat.format(new Date(iso));
  if (b.startsAt && b.endsAt) return `Del ${fmt(b.startsAt)} al ${fmt(b.endsAt)}`;
  if (b.startsAt) return `Desde el ${fmt(b.startsAt)}`;
  if (b.endsAt) return `Hasta el ${fmt(b.endsAt)}`;
  return null;
}

function BannerRow({ banner, position, total, status, busy, onUp, onDown, onToggle, editHref, onDelete }: {
  banner: AdminBanner; position: number; total: number; status: BannerStatus; busy: boolean;
  onUp: () => void; onDown: () => void; onToggle: () => void; editHref: string; onDelete: () => void;
}) {
  const name = banner.title ?? "Banner sin título";
  const when = schedule(banner);
  return (
    <li className="px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative aspect-[16/7] w-full shrink-0 overflow-hidden rounded-lg bg-brand-sand sm:w-48">
          <Image src={productImageUrl(banner.imagePath)} alt={banner.imageAlt ?? name} fill sizes="192px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-medium">{name}</p>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          </div>
          {banner.body && <p className="mt-0.5 line-clamp-2 text-sm text-brand-muted">{banner.body}</p>}
          <p className="mt-1 break-words text-xs text-brand-muted">
            Posición {position} de {total}
            {when ? ` · ${when}` : ""}
            {banner.linkUrl ? ` · Lleva a ${banner.linkUrl}` : " · Sin enlace"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[12.75rem]">
        <Button size="sm" disabled={busy || position === 1} onClick={onUp} aria-label={`Subir «${name}»`}>
          <Icon name="chevronDown" className="size-4 rotate-180" />
        </Button>
        <Button size="sm" disabled={busy || position === total} onClick={onDown} aria-label={`Bajar «${name}»`}>
          <Icon name="chevronDown" className="size-4" />
        </Button>
        <Button size="sm" disabled={busy} onClick={onToggle} aria-pressed={banner.isActive}>
          {banner.isActive ? "Desactivar" : "Activar"}
        </Button>
        <LinkButton size="sm" icon="edit" href={editHref} aria-label={`Editar «${name}»`}>Editar</LinkButton>
        <Button size="sm" icon="trash" disabled={busy} onClick={onDelete} aria-label={`Eliminar «${name}»`}>Eliminar</Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- formulario

function BannerForm({ db, banner, nextPosition, onCancel, onSaved, onError }: {
  db: SupabaseClient; banner: AdminBanner | null; nextPosition: number; onCancel: () => void;
  onSaved: (message: string) => Promise<void>; onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [body, setBody] = useState(banner?.body ?? "");
  const [badge, setBadge] = useState(banner?.badge ?? "");
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? "");
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl ?? "");
  const [imageAlt, setImageAlt] = useState(banner?.imageAlt ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.endsAt ?? null));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<BannerFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMainCategories(db).then((c) => !cancelled && setCategories(c)).catch(() => undefined);
    return () => {
      cancelled = true;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [db]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    try {
      const image = await prepareImage(file, "banner");
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = image.previewUrl;
      setPrepared(image);
      setErrors((e) => ({ ...e, hasImage: undefined }));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "No se pudo leer la imagen.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateBannerForm({
      title, body, badge, ctaLabel, linkUrl, imageAlt, startsAt, endsAt, hasImage: Boolean(prepared || banner),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: BannerInput = {
      title: clean(title), body: clean(body), badge: clean(badge), ctaLabel: clean(ctaLabel), linkUrl: clean(linkUrl),
      imageAlt: clean(imageAlt), isActive, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt),
    };
    setBusy(true);
    try {
      if (banner) {
        const { oldFileKept } = await updateBanner(db, banner, input, prepared);
        await onSaved(oldFileKept ? "Cambios guardados. La imagen anterior quedó en Storage y se puede borrar a mano." : "Cambios guardados.");
      } else if (prepared) {
        await createBanner(db, input, prepared, nextPosition);
        await onSaved(isActive ? "Banner creado. Ya se muestra en el catálogo." : "Banner creado sin activar.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : friendlyError(null));
      setBusy(false);
    }
  }

  const previewUrl = prepared?.previewUrl ?? (banner ? productImageUrl(banner.imagePath) : null);
  const safeLink = linkUrl.trim() && !errors.linkUrl ? linkUrl.trim() : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {previewUrl ? (
        <div aria-label="Vista previa del banner" className="pointer-events-none select-none" inert>
          <PromoCarousel
            banners={[{
              id: "preview", title: clean(title), body: clean(body), badge: clean(badge), ctaLabel: clean(ctaLabel),
              linkUrl: safeLink, imageUrl: previewUrl, imageAlt: clean(imageAlt),
            }]}
          />
        </div>
      ) : (
        <div className="grid aspect-[16/7] place-items-center rounded-xl border border-dashed border-brand-line bg-brand-sand text-sm text-brand-muted">
          Todavía no elegiste una imagen
        </div>
      )}

      <Field
        label={banner ? "Reemplazar imagen (opcional)" : "Imagen"}
        error={errors.hasImage ?? fileError}
        hint={`JPG, PNG o WebP, hasta 5 MB. Apaisada, de unos ${BANNER_RECOMMENDED_SIZE}, para que no se recorte nada. Si incluye precios o textos, ponelos lejos de los bordes.`}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="block w-full text-sm file:mr-3 file:h-11 file:cursor-pointer file:rounded-lg file:border file:border-brand-line file:bg-white file:px-4 file:text-sm file:font-medium hover:file:border-brand-ink"
          />
        )}
      </Field>
      {prepared && (
        <p className="-mt-3 text-xs text-brand-muted">
          Lista para subir: {prepared.width} × {prepared.height} px, {(prepared.blob.size / 1024).toFixed(0)} KB.
        </p>
      )}

      <TextInput label="Descripción de la imagen" value={imageAlt} maxLength={BANNER_LIMITS.alt} error={errors.imageAlt}
        hint="Para quienes no ven la imagen. Si la dejás vacía se usa el título." onChange={(e) => setImageAlt(e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Título (opcional)" value={title} maxLength={BANNER_LIMITS.title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
        <TextInput label="Etiqueta (opcional)" value={badge} maxLength={BANNER_LIMITS.badge} error={errors.badge} placeholder="Oferta, Combo…" onChange={(e) => setBadge(e.target.value)} />
      </div>
      <TextInput label="Texto breve (opcional)" value={body} maxLength={BANNER_LIMITS.body} error={errors.body} onChange={(e) => setBody(e.target.value)} />

      <div className="space-y-2">
        <TextInput label="Enlace de destino (opcional)" value={linkUrl} maxLength={BANNER_LIMITS.link} error={errors.linkUrl}
          placeholder="/?categoria=cocina" onChange={(e) => setLinkUrl(e.target.value)}
          hint="Una página de este sitio (empieza con /) o una dirección https://. Para llevar a un producto o combo usá una búsqueda, por ejemplo /?q=balde." />
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-brand-muted">Atajos:</span>
            {categories.map((c) => (
              <Button key={c.id} size="sm" onClick={() => setLinkUrl(`/?categoria=${c.slug}#catalogo`)}>{c.name}</Button>
            ))}
          </div>
        )}
      </div>
      <TextInput label="Texto del botón (opcional)" value={ctaLabel} maxLength={BANNER_LIMITS.cta} error={errors.ctaLabel} placeholder="Ver promoción" onChange={(e) => setCtaLabel(e.target.value)} />

      <fieldset className="space-y-3 rounded-lg border border-brand-line p-4">
        <legend className="px-1 text-sm font-medium">Vigencia (opcional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde" error={errors.startsAt}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="datetime-local" value={startsAt} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS} onChange={(e) => setStartsAt(e.target.value)} />
            )}
          </Field>
          <Field label="Hasta" error={errors.endsAt}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="datetime-local" value={endsAt} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT_CLASS} onChange={(e) => setEndsAt(e.target.value)} />
            )}
          </Field>
        </div>
        <p className="text-xs text-brand-muted">Sin fechas, el banner se muestra mientras esté activo. Se usa la hora de este dispositivo.</p>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-brand-green" />
        Mostrar en el catálogo (activo)
      </label>

      {/* Acciones siempre a mano en formularios largos (sobre todo en el celular). */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t border-brand-line bg-white px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : banner ? "Guardar cambios" : "Crear banner"}</Button>
      </div>
    </form>
  );
}
