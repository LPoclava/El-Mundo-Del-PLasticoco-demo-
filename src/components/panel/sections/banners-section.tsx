"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PromoCarousel } from "@/components/catalog/promo-carousel";
import {
  createBanner, deleteBanner, listBanners, listMainCategories, reorderBanners,
  setBannerActive, setCategoryImage, updateBanner, type AdminBanner, type AdminCategory, type BannerInput,
} from "@/lib/banners/admin";
import { prepareImage, type PreparedImage } from "@/lib/banners/image";
import {
  BANNER_LIMITS, BANNER_RECOMMENDED_SIZE, CATEGORY_RECOMMENDED_SIZE, STATUS_LABEL, bannerStatus, fromLocalInput,
  toLocalInput, validateBannerForm, type BannerFormErrors, type BannerStatus,
} from "@/lib/banners/rules";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { friendlyError } from "@/lib/supabase/errors";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { SupabaseGate } from "../supabase-gate";
import { useToasts } from "../use-toasts";
import {
  Badge, Button, CARD_CLASS, Dialog, EmptyState, Field, INPUT_CLASS, Notice, PageHeader, TextInput,
  Toaster, type Toast,
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
        <Notice tone="warn" title="Supabase no está configurado">
          Faltan las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.local.example). Sin ellas
          esta sección no puede guardar ni leer banners.
        </Notice>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- administrador

const clean = (v: string) => v.trim() || null;

type Draft = { mode: "new" } | { mode: "edit"; banner: AdminBanner } | null;

function Manager({ db }: { db: SupabaseClient }) {
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [now, setNow] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toasts, push } = useToasts();

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
  if (!banners) return <p role="status" className="text-sm text-brand-muted">Cargando banners…</p>;

  const activeCount = banners.filter((b) => bannerStatus(b, now) === "active").length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-muted" aria-live="polite">
          {banners.length === 0 ? "Todavía no hay banners." : `${activeCount} en el catálogo ahora · ${banners.length} en total`}
        </p>
        <Button variant="primary" icon="plus" onClick={() => setDraft({ mode: "new" })}>Nuevo banner</Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState title="El catálogo no muestra promociones" action={<Button variant="primary" icon="plus" onClick={() => setDraft({ mode: "new" })}>Crear el primer banner</Button>}>
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
                onEdit={() => setDraft({ mode: "edit", banner: b })}
                onDelete={() => setDeleting(b)}
              />
            ))}
          </ol>
        </section>
      )}

      <CategoryImages db={db} notify={push} />

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        variant="sheet"
        title={draft?.mode === "edit" ? "Editar banner" : "Nuevo banner"}
        description="Lo que ves en la vista previa es lo que va a ver el cliente."
      >
        {draft && (
          <BannerForm
            key={draft.mode === "edit" ? draft.banner.id : "new"}
            db={db}
            banner={draft.mode === "edit" ? draft.banner : null}
            nextPosition={Math.max(0, ...banners.map((b) => b.position)) + 1}
            onCancel={() => setDraft(null)}
            onSaved={async (message) => {
              setDraft(null);
              await reload();
              push(message);
            }}
            onError={(message) => push(message, "error")}
          />
        )}
      </Dialog>

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

function BannerRow({ banner, position, total, status, busy, onUp, onDown, onToggle, onEdit, onDelete }: {
  banner: AdminBanner; position: number; total: number; status: BannerStatus; busy: boolean;
  onUp: () => void; onDown: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void;
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
        <Button size="sm" icon="edit" disabled={busy} onClick={onEdit} aria-label={`Editar «${name}»`}>Editar</Button>
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

      <div className="flex justify-end gap-2 border-t border-brand-line pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : banner ? "Guardar cambios" : "Crear banner"}</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- fotos de las categorías principales

function CategoryImages({ db, notify }: { db: SupabaseClient; notify: (message: string, tone?: Toast["tone"]) => void }) {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCategories(await listMainCategories(db));
    } catch (e) {
      notify(e instanceof Error ? e.message : friendlyError(null), "error");
      setCategories([]);
    }
  }, [db, notify]);

  useEffect(() => {
    let cancelled = false;
    listMainCategories(db)
      .then((list) => !cancelled && setCategories(list))
      .catch((e) => {
        if (cancelled) return;
        notify(e instanceof Error ? e.message : friendlyError(null), "error");
        setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [db, notify]);

  if (!categories || categories.length === 0) return null;

  async function change(category: AdminCategory, file: File | undefined) {
    if (!file) return;
    setBusy(category.id);
    let image: PreparedImage | null = null;
    try {
      image = await prepareImage(file, "category");
      await setCategoryImage(db, category, image);
      await load();
      notify(`Foto de «${category.name}» actualizada.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : friendlyError(null), "error");
    } finally {
      if (image) URL.revokeObjectURL(image.previewUrl);
      setBusy(null);
    }
  }

  async function clear(category: AdminCategory) {
    setBusy(category.id);
    try {
      await setCategoryImage(db, category, null);
      await load();
      notify(`Foto de «${category.name}» quitada. La tarjeta vuelve a mostrar un ícono.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : friendlyError(null), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`${CARD_CLASS} p-5`} aria-labelledby="fotos-categorias">
      <h2 id="fotos-categorias" className="text-base font-semibold">Fotos de las categorías principales</h2>
      <p className="mt-1 text-sm text-brand-muted">
        Cada tarjeta de «Explorá por categoría» puede llevar una foto (JPG, PNG o WebP, unos {CATEGORY_RECOMMENDED_SIZE}). Sin foto
        se muestra un ícono.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg border border-brand-line p-3">
            <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-sand text-brand-muted">
              {c.imagePath ? (
                <Image src={productImageUrl(c.imagePath)} alt={`Foto actual de ${c.name}`} fill sizes="64px" className="object-cover" />
              ) : (
                <Icon name="image" className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <label className={`inline-flex h-9 cursor-pointer items-center rounded-lg border border-brand-line bg-white px-3 text-sm font-medium hover:border-brand-ink ${busy === c.id ? "pointer-events-none opacity-50" : ""}`}>
                  {c.imagePath ? "Cambiar foto" : "Subir foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy === c.id}
                    aria-label={`${c.imagePath ? "Cambiar" : "Subir"} la foto de ${c.name}`}
                    onChange={(e) => {
                      void change(c, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {c.imagePath && (
                  <Button size="sm" disabled={busy === c.id} onClick={() => void clear(c)}>Quitar</Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
