"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareImage } from "@/lib/banners/image";
import { PRODUCT_MAX_IMAGES, PRODUCT_RECOMMENDED_SIZE } from "@/lib/banners/rules";
import {
  SaveError, getProduct, listCategories, saveProduct, type AdminProduct, type CategoryOption, type ImageDraft,
} from "@/lib/products/admin";
import {
  PRODUCT_LIMITS, ensureSinglePrimary, hasErrors, moveItem, parsePrice, pricesOf, publishBlockers,
  validateProductForm, type ProductFormErrors, type VariantDraft,
} from "@/lib/products/rules";
import { productImageUrl } from "@/lib/supabase/public";
import { Icon } from "../icons";
import { BrandLoader } from "@/components/brand-loader";
import { withTimeout } from "@/lib/async";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { setFlash } from "../flash";
import { SupabaseGate } from "../supabase-gate";
import { useToasts } from "../use-toasts";
import { Button, CARD_CLASS, Field, INPUT_CLASS, LinkButton, Notice, PageHeader, TextInput, Toaster } from "../ui";

let seq = 0;
const nextKey = () => `k${++seq}`;

const clean = (v: string) => v.trim() || null;

type FormProps = {
  db: SupabaseClient;
  categories: CategoryOption[];
  /** Vuelve al listado (al guardar o al cancelar). */
  onClose: () => void;
  /** Se llama tras guardar (o tras un guardado parcial). */
  onChanged: () => void;
  notify: (message: string, tone?: "ok" | "error") => void;
};

/**
 * Pantalla completa de alta y edición de un producto REAL (Supabase): datos, variantes con precio y hasta 5
 * fotos. Vive en /panel/productos/nuevo y /panel/productos/[id]: se puede recargar, compartir y volver atrás.
 */
export function ProductEditor({ productId }: { productId: string | null }) {
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/panel/productos", label: "Productos" }}
        title={productId ? "Editar producto" : "Crear producto"}
        subtitle="Los cambios se guardan en la base real."
      />
      {isBrowserSupabaseConfigured ? (
        <SupabaseGate action="administrar productos">{(db) => <EditorData key={productId ?? "nuevo"} db={db} productId={productId} />}</SupabaseGate>
      ) : (
        <Notice tone="warn" title="Falta configurar la conexión">
          Sin la conexión con la base de datos no se puede leer ni guardar nada acá. Avisá a quien administra el sistema.
        </Notice>
      )}
    </div>
  );
}

const LOAD_TIMEOUT_MS = 20_000;

type Loaded =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; product: AdminProduct | null; categories: CategoryOption[] };

function EditorData({ db, productId }: { db: SupabaseClient; productId: string | null }) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  // El formulario necesita las categorías y, al editar, el producto: hasta tenerlos no hay pantalla que mostrar.
  useEffect(() => {
    let cancelled = false;
    withTimeout(Promise.all([listCategories(db), productId ? getProduct(db, productId) : Promise.resolve(null)]), LOAD_TIMEOUT_MS)
      .then(([categories, product]) => !cancelled && setLoaded({ state: "ready", product, categories }))
      .catch((e: unknown) => !cancelled && setLoaded({ state: "error", message: e instanceof Error ? e.message : "No se pudo leer el producto." }));
    return () => {
      cancelled = true;
    };
  }, [db, productId, attempt]);

  if (loaded.state === "loading") return <BrandLoader label={productId ? "Cargando el producto…" : "Preparando el formulario…"} />;
  if (loaded.state === "error") {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="No se pudo abrir el producto">{loaded.message}</Notice>
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
          <LinkButton href="/panel/productos">Volver a productos</LinkButton>
        </div>
      </div>
    );
  }
  return (
    <>
      <FormBody
        db={db}
        initial={loaded.product}
        categories={loaded.categories}
        onClose={() => router.push("/panel/productos")}
        onChanged={() => undefined}
        // Los avisos de éxito se muestran en el listado, que es adonde se vuelve al guardar.
        notify={(message, tone = "ok") => (tone === "ok" ? setFlash({ message, tone }) : push(message, tone))}
      />
      <Toaster toasts={toasts} />
    </>
  );
}

const draftsOf = (p: AdminProduct | null): VariantDraft[] =>
  (p?.variants ?? []).map((v) => ({ key: nextKey(), id: v.id, size: v.size ?? "", color: v.color ?? "", price: v.price === null ? "" : String(v.price) }));

const imagesOf = (p: AdminProduct | null): ImageDraft[] =>
  ensureSinglePrimary((p?.images ?? []).map((i) => ({ key: nextKey(), id: i.id, path: i.path, image: null, isPrimary: i.isPrimary })));

const emptyVariant = (): VariantDraft => ({ key: nextKey(), id: null, size: "", color: "", price: "" });
const isEmptyVariant = (v: VariantDraft) => !v.size.trim() && !v.color.trim() && !v.price.trim();

function previewOf(d: ImageDraft): string | null {
  return d.image?.previewUrl ?? (d.path ? productImageUrl(d.path) : null);
}

function FormBody({ db, initial, categories, onClose, onChanged, notify }: FormProps & { initial: AdminProduct | null }) {
  const [baseline, setBaseline] = useState<AdminProduct | null>(initial);
  const [productId, setProductId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    const list = draftsOf(initial);
    return list.length > 0 ? list : [emptyVariant()];
  });
  // Un producto de un solo precio muestra solo el campo «Precio»; los tamaños y colores son opcionales.
  const [multi, setMulti] = useState(() => {
    const list = draftsOf(initial);
    return list.length > 1 || (list.length === 1 && Boolean(list[0].size.trim() || list[0].color.trim()));
  });
  const onlyVariantIsPlain = variants.length === 1 && !variants[0].size.trim() && !variants[0].color.trim();
  const [images, setImages] = useState<ImageDraft[]>(() => imagesOf(initial));
  const [wantPublished, setWantPublished] = useState(initial?.publishEnabled ?? false);
  const [errors, setErrors] = useState<ProductFormErrors>({ variants: {} });
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Bloquea envíos repetidos aunque el estado "busy" todavía no se haya pintado (doble clic).
  const submitting = useRef(false);
  const previews = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const hasPrimary = images.some((i) => i.isPrimary);
  const blockers = publishBlockers({ hasPrimaryImage: hasPrimary, prices: pricesOf(variants.filter((v) => !isEmptyVariant(v))) });
  const canPublish = blockers.length === 0;
  const publishChecked = wantPublished && canPublish;

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = PRODUCT_MAX_IMAGES - images.length;
    const list = Array.from(files);
    const problems: string[] = [];
    const warnings: string[] = [];
    if (list.length > room) problems.push(`Solo entran ${PRODUCT_MAX_IMAGES} fotos: se usaron ${Math.max(room, 0)} de las ${list.length} elegidas.`);
    setProcessing(true);
    const added: ImageDraft[] = [];
    for (const file of list.slice(0, Math.max(room, 0))) {
      try {
        const image = await prepareImage(file, "product");
        previews.current.add(image.previewUrl);
        if (image.warning) warnings.push(`${file.name}: ${image.warning}`);
        added.push({ key: nextKey(), id: null, path: null, image, isPrimary: false });
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof Error ? e.message : "no se pudo leer."}`);
      }
    }
    setProcessing(false);
    setPhotoErrors(problems);
    setPhotoWarnings(warnings);
    if (added.length > 0) setImages((cur) => ensureSinglePrimary([...cur, ...added]));
  }

  function removeImage(key: string) {
    setImages((cur) => {
      const gone = cur.find((i) => i.key === key);
      if (gone?.image) {
        URL.revokeObjectURL(gone.image.previewUrl);
        previews.current.delete(gone.image.previewUrl);
      }
      return ensureSinglePrimary(cur.filter((i) => i.key !== key));
    });
  }

  /** Al corregir un campo se retira su aviso de error; el siguiente envío vuelve a validar todo. */
  const clearError = (field: "name" | "brand" | "description" | "categoryId" | "barcode" | "sku") =>
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const setPrimary = (key: string) => setImages((cur) => cur.map((i) => ({ ...i, isPrimary: i.key === key })));
  const moveImage = (index: number, delta: -1 | 1) => setImages((cur) => moveItem(cur, index, index + delta));
  const patchVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((cur) => cur.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;

    const kept = variants.filter((v) => !isEmptyVariant(v));
    const found = validateProductForm({
      name, brand, description, categoryId, barcode, sku, variants: kept, imageCount: images.length,
    });
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) return;

    submitting.current = true;
    setBusy(true);
    try {
      const outcome = await saveProduct(db, {
        productId,
        baseline,
        fields: { name: name.trim(), brand: clean(brand), description: clean(description), categoryId, barcode: clean(barcode), sku: clean(sku) },
        variants: kept.map((v) => {
          const price = parsePrice(v.price);
          return { key: v.key, id: v.id, size: clean(v.size), color: clean(v.color), price: price.ok ? price.value : null };
        }),
        images,
        wantPublished: publishChecked,
      });
      onChanged();
      notify(outcome.notes.length > 0 ? `Guardado. ${outcome.notes.join(" ")}` : outcome.published ? "Producto guardado y publicado." : "Producto guardado.");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto.";
      setFormError(message);
      if (err instanceof SaveError && err.productId) {
        // Algo quedó guardado: se pasa a modo edición para que reintentar no cree otro producto ni repita fotos.
        setProductId(err.productId);
        setImages((cur) =>
          cur.map((d) => {
            const saved = err.images[d.key];
            return saved ? { ...d, id: saved.id, path: saved.path, image: null } : d;
          }),
        );
        setVariants((cur) => cur.map((v) => (err.variants[v.key] ? { ...v, id: err.variants[v.key] } : v)));
        try {
          setBaseline(await getProduct(db, err.productId));
        } catch {
          // Sin la lectura de control, el próximo guardado volverá a comparar contra la base.
        }
        onChanged();
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={`${CARD_CLASS} max-w-4xl space-y-5 p-4 sm:p-6`} aria-busy={busy}>
      {formError && (
        <Notice tone="warn" title="No se pudo guardar todo">
          {formError}
          {productId && !initial && " El producto ya existe en la base: si volvés a guardar se actualiza, no se duplica."}
        </Notice>
      )}

      <TextInput label="Nombre" value={name} maxLength={PRODUCT_LIMITS.name} error={errors.name} onChange={(e) => { setName(e.target.value); clearError("name"); }} autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Marca (opcional)" value={brand} maxLength={PRODUCT_LIMITS.brand} error={errors.brand} onChange={(e) => { setBrand(e.target.value); clearError("brand"); }} />
        <Field label="Categoría" error={errors.categoryId}>
          {({ id, describedBy, invalid }) => (
            <select id={id} aria-describedby={describedBy} aria-invalid={invalid} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); clearError("categoryId"); }} className={INPUT_CLASS}>
              <option value="">Elegí una categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </Field>
      </div>
      {!multi ? (
        <fieldset className="space-y-3 rounded-lg border border-brand-line p-4">
          <legend className="px-1 text-sm font-medium">Precio</legend>
          <TextInput
            label="Precio del producto (en pesos)" inputMode="numeric" value={variants[0].price}
            error={(errors.variants[variants[0].key] ?? {}).price}
            onChange={(ev) => patchVariant(variants[0].key, { price: ev.target.value })}
            hint="Pesos enteros, sin centavos. Sin precio el producto no se publica en el catálogo."
          />
          {errors.variants[variants[0].key]?.duplicate && <p className="text-sm text-brand-danger">{errors.variants[variants[0].key]?.duplicate}</p>}
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setMulti(true)}>Tiene tamaños o colores con precios distintos</Button>
        </fieldset>
      ) : (
      <fieldset className="space-y-3 rounded-lg border border-brand-line p-4">
        <legend className="px-1 text-sm font-medium">Precios por tamaño o color</legend>
        <p className="text-xs text-brand-muted">Pesos enteros, sin centavos. Una variante sin precio no cuenta para publicar. Cada tamaño o color lleva su propio precio.</p>
        {variants.map((v, i) => {
          const e = errors.variants[v.key] ?? {};
          return (
            <div key={v.key} className="rounded-lg bg-brand-cream/60 p-3">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
                <TextInput label={`Tamaño ${i + 1}`} value={v.size} maxLength={PRODUCT_LIMITS.variantText} error={e.size} onChange={(ev) => patchVariant(v.key, { size: ev.target.value })} />
                <TextInput label="Color" value={v.color} maxLength={PRODUCT_LIMITS.variantText} error={e.color} onChange={(ev) => patchVariant(v.key, { color: ev.target.value })} />
                <TextInput label="Precio" inputMode="numeric" value={v.price} error={e.price} onChange={(ev) => patchVariant(v.key, { price: ev.target.value })} />
                <Button size="sm" className="mt-[1.875rem] w-9 px-0" aria-label={`Quitar la variante ${i + 1}`} title="Quitar variante" onClick={() => setVariants((cur) => cur.filter((x) => x.key !== v.key))}>
                  <Icon name="trash" className="size-4" />
                </Button>
              </div>
              {e.duplicate && <p className="mt-1.5 text-sm text-brand-danger">{e.duplicate}</p>}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="plus" onClick={() => setVariants((cur) => [...cur, emptyVariant()])}>Agregar variante</Button>
          {onlyVariantIsPlain && <Button size="sm" variant="ghost" onClick={() => setMulti(false)}>Usar un solo precio</Button>}
        </div>
      </fieldset>

      )}

      <Field label="Descripción (opcional)" error={errors.description} hint="Se usa también en el buscador del catálogo.">
        {({ id, describedBy, invalid }) => (
          <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} rows={3} maxLength={PRODUCT_LIMITS.description} value={description}
            onChange={(e) => { setDescription(e.target.value); clearError("description"); }}
            className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm placeholder:text-brand-muted focus-visible:border-brand-ink aria-[invalid=true]:border-brand-danger" />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Código de barras (opcional)" inputMode="numeric" value={barcode} error={errors.barcode} onChange={(e) => { setBarcode(e.target.value); clearError("barcode"); }} hint="De 8 a 14 dígitos. No puede repetirse." />
        <TextInput label="SKU interno (opcional)" value={sku} maxLength={PRODUCT_LIMITS.sku} error={errors.sku} onChange={(e) => { setSku(e.target.value); clearError("sku"); }} hint="No puede repetirse." />
      </div>

      <fieldset className="space-y-3 rounded-lg border border-brand-line p-4">
        <legend className="px-1 text-sm font-medium">Fotos ({images.length} de {PRODUCT_MAX_IMAGES})</legend>
        <p className="text-xs text-brand-muted">
          JPG, PNG o WebP, hasta 5 MB cada una. Casi cuadradas, de unos {PRODUCT_RECOMMENDED_SIZE}. La principal es la que se ve en el catálogo.
        </p>
        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3">
            {images.map((d, i) => {
              const src = previewOf(d);
              return (
                <li key={d.key} className={`rounded-lg border p-2 ${d.isPrimary ? "border-brand-orange ring-1 ring-brand-orange" : "border-brand-line"}`}>
                  <div className="relative aspect-square overflow-hidden rounded-md bg-brand-sand">
                    {src && <Image src={src} alt={`Foto ${i + 1}${d.isPrimary ? " (principal)" : ""}`} fill sizes="160px" className="object-cover" />}
                    {!d.id && <span className="absolute left-1 top-1 rounded bg-brand-ink/80 px-1.5 py-0.5 text-[11px] text-white">Nueva</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Button size="sm" className="w-full" variant={d.isPrimary ? "primary" : "secondary"} aria-pressed={d.isPrimary} aria-label={d.isPrimary ? `Foto ${i + 1}: es la principal` : `Hacer principal la foto ${i + 1}`} onClick={() => setPrimary(d.key)}>
                      {d.isPrimary ? <><Icon name="check" className="size-4" />Principal</> : "Principal"}
                    </Button>
                    <Button size="sm" className="w-9 px-0" disabled={i === 0} aria-label={`Mover la foto ${i + 1} a la izquierda`} onClick={() => moveImage(i, -1)}>
                      <Icon name="chevronLeft" className="size-4" />
                    </Button>
                    <Button size="sm" className="w-9 px-0" disabled={i === images.length - 1} aria-label={`Mover la foto ${i + 1} a la derecha`} onClick={() => moveImage(i, 1)}>
                      <Icon name="chevronRight" className="size-4" />
                    </Button>
                    <Button size="sm" className="w-9 px-0" aria-label={`Quitar la foto ${i + 1}`} title="Quitar foto" onClick={() => removeImage(d.key)}>
                      <Icon name="trash" className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {images.length < PRODUCT_MAX_IMAGES && (
          <label className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-brand-line bg-white px-4 text-sm font-medium hover:border-brand-ink ${processing || busy ? "pointer-events-none opacity-50" : ""}`}>
            <Icon name="plus" className="size-4" />
            {processing ? "Preparando fotos…" : "Agregar fotos"}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={processing || busy}
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {errors.images && <p className="text-sm text-brand-danger">{errors.images}</p>}
        {photoErrors.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-brand-danger">
            {photoErrors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
        {photoWarnings.length > 0 && (
          <ul role="status" className="space-y-1 rounded-lg border border-brand-orange/50 bg-brand-orange/10 p-3 text-sm">
            {photoWarnings.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
        <p className="text-xs text-brand-muted">Las fotos nuevas se suben al guardar; las que quitás se borran de Storage recién cuando el guardado termina bien.</p>
      </fieldset>

      <div className="rounded-lg border border-brand-line p-4">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={publishChecked} disabled={!canPublish} onChange={(e) => setWantPublished(e.target.checked)} className="size-5 accent-brand-green" />
          Publicar en el catálogo
        </label>
        {!canPublish && (
          <ul className="mt-1 list-disc space-y-0.5 pl-9 text-xs text-brand-muted">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {canPublish && <p className="mt-1 pl-9 text-xs text-brand-muted">Con foto principal y precio válido el producto aparece en el catálogo al guardar.</p>}
      </div>

      {/* Acciones siempre a mano en formularios largos (sobre todo en el celular). */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t border-brand-line bg-white px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy || processing}>{busy ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}</Button>
      </div>
    </form>
  );
}
