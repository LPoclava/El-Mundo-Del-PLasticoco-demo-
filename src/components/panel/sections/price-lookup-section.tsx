"use client";

import { useRef, useState, type FormEvent } from "react";
import { SAMPLE_CODES } from "@/lib/panel-demo/data";
import { formatPrice, normalize } from "@/lib/panel-demo/format";
import { parsePrice, validateBarcode } from "@/lib/panel-demo/store";
import type { DemoProduct } from "@/lib/panel-demo/types";
import { BarcodeScanner } from "../barcode-scanner";
import { useDemo } from "../demo-provider";
import { Ean13Svg } from "../ean13-svg";
import { Icon } from "../icons";
import {
  Badge, Button, CARD_CLASS, INPUT_CLASS, Notice, PageHeader, ProductThumb, SelectInput, TextInput,
} from "../ui";

type Result =
  | { kind: "idle" }
  | { kind: "found"; productId: string }
  | { kind: "unknown"; code: string };

type Panel = "none" | "price" | "link";

export function PriceLookupSection() {
  const { state, notify } = useDemo();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [recent, setRecent] = useState<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  function search(raw: string, fromCamera = false) {
    const value = raw.trim();
    const bad = validateBarcode(value);
    setCodeError(bad);
    if (bad) return;
    setCode(value);
    const product = state.products.find((p) => p.barcode === value);
    setResult(product ? { kind: "found", productId: product.id } : { kind: "unknown", code: value });
    setRecent((r) => [value, ...r.filter((x) => x !== value)].slice(0, 5));
    // En el celular el resultado queda debajo de la cámara: se lo acerca a la vista.
    if (fromCamera) {
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }),
      );
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    search(code);
  }

  function goManual() {
    requestAnimationFrame(() => manualRef.current?.focus());
  }

  const product = result.kind === "found" ? state.products.find((p) => p.id === result.productId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consulta de precios"
        subtitle="Escaneá el código de barras con la cámara para ver el precio, corregirlo o dar de alta un producto nuevo."
      />

      <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-label="Escanear código de barras">
        <BarcodeScanner onDetect={(c) => search(c, true)} onManual={goManual} />
      </section>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-20">
        {result.kind === "found" && product && <FoundProduct key={product.id} product={product} />}
        {result.kind === "unknown" && (
          <UnknownCode
            key={result.code}
            code={result.code}
            onCreated={(id) => { setResult({ kind: "found", productId: id }); notify("Producto creado sin publicar (simulación)."); }}
            onLinked={(id) => { setResult({ kind: "found", productId: id }); notify("Código vinculado (simulación)."); }}
          />
        )}
      </div>

      <section className="rounded-xl border border-brand-line bg-white/60 p-4" aria-label="Ingreso manual">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor="manual-code" className="mb-1.5 block text-sm font-medium">¿Sin cámara? Ingresá el código a mano</label>
            <input
              id="manual-code" ref={manualRef} inputMode="numeric" autoComplete="off" placeholder="Código de 8 a 14 dígitos"
              value={code} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? "manual-code-error" : undefined}
              onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
              className={INPUT_CLASS}
            />
            {codeError && <p id="manual-code-error" className="mt-1.5 text-sm text-brand-danger">{codeError}</p>}
          </div>
          <Button type="submit" icon="search" className="sm:mt-[1.625rem]">Buscar</Button>
        </form>

        {recent.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-brand-muted">Últimas consultas</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {recent.map((c) => (
                <li key={c}><Button size="sm" variant="ghost" onClick={() => { setCode(c); search(c); }} className="border border-brand-line tabular-nums">{c}</Button></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <details className="rounded-xl border border-brand-line bg-white/60 p-4">
        <summary className="cursor-pointer text-sm font-medium">Probar la cámara sin un producto real</summary>
        <p className="mt-2 text-sm text-brand-muted">
          Apuntá la cámara del celular a estos códigos en la pantalla de la computadora. Son de ejemplo y no corresponden a productos reales.
          Con el último podés probar el alta de un producto nuevo.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {[...SAMPLE_CODES.found, SAMPLE_CODES.unknown].map((c) => {
            const known = state.products.find((p) => p.barcode === c);
            return (
              <li key={c} className="rounded-lg border border-brand-line bg-white p-3">
                <Ean13Svg code={c} className="h-auto w-full max-w-xs" />
                <p className="mt-1 text-xs text-brand-muted">{known ? known.name : "Código no registrado"}</p>
                <Button size="sm" variant="ghost" className="mt-1 border border-brand-line" onClick={() => { setCode(c); search(c); }}>Consultar sin cámara</Button>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

function FoundProduct({ product }: { product: DemoProduct }) {
  const { state, actions, notify } = useDemo();
  const [panel, setPanel] = useState<Panel>("none");
  const [price, setPrice] = useState(String(product.price));
  const [priceError, setPriceError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState(product.barcode ?? "");
  const [codeError, setCodeError] = useState<string | null>(null);
  const category = state.categories.find((c) => c.id === product.categoryId)?.name ?? "Sin categoría";

  function savePrice(e: FormEvent) {
    e.preventDefault();
    const value = parsePrice(price);
    if (value === null) return setPriceError("Ingresá un precio entero mayor que 0, sin centavos.");
    actions.setPrice(product.id, value);
    setPanel("none");
    notify(`Precio actualizado a ${formatPrice(value)} (simulación).`);
  }

  function saveCode(e: FormEvent) {
    e.preventDefault();
    const error = actions.linkBarcode(product.id, newCode);
    if (error) return setCodeError(error);
    setPanel("none");
    notify("Código actualizado (simulación).");
  }

  return (
    <article className={`${CARD_CLASS} p-5`} aria-label={`Resultado: ${product.name}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProductThumb seed={product.categoryId} className="size-24 sm:size-28" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{product.name}</h2>
            {product.archived ? <Badge tone="muted">Archivado</Badge> : product.published ? <Badge tone="ok">Publicado</Badge> : <Badge tone="warn">Sin publicar</Badge>}
          </div>
          <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-brand-muted">Marca</dt><dd>{product.brand || "—"}</dd>
            <dt className="text-brand-muted">Categoría</dt><dd>{category}</dd>
            <dt className="text-brand-muted">Código</dt><dd className="tabular-nums">{product.barcode ?? "Sin código"}</dd>
          </dl>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{formatPrice(product.price)}</p>
        </div>
      </div>

      {product.archived ? (
        <div className="mt-4"><Notice tone="warn">Este producto está archivado: no se puede cambiar su precio ni su código desde el escáner. Un gerente puede desarchivarlo.</Notice></div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icon="edit" aria-expanded={panel === "price"} onClick={() => { setPanel(panel === "price" ? "none" : "price"); setPrice(String(product.price)); setPriceError(null); }}>Modificar precio</Button>
            <Button icon="link" aria-expanded={panel === "link"} onClick={() => { setPanel(panel === "link" ? "none" : "link"); setNewCode(product.barcode ?? ""); setCodeError(null); }}>Vincular código</Button>
          </div>

          {panel === "price" && (
            <form onSubmit={savePrice} noValidate className="mt-4 flex flex-col gap-3 rounded-lg bg-brand-cream p-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <TextInput label="Nuevo precio (en pesos)" inputMode="numeric" value={price} error={priceError} autoFocus
                  hint="Solo pesos enteros. El cambio queda en el historial." onChange={(e) => { setPrice(e.target.value); setPriceError(null); }} />
              </div>
              <div className="flex gap-2 sm:mt-[1.625rem]">
                <Button type="submit" variant="primary">Guardar</Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>Cancelar</Button>
              </div>
            </form>
          )}
          {panel === "link" && (
            <form onSubmit={saveCode} noValidate className="mt-4 flex flex-col gap-3 rounded-lg bg-brand-cream p-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <TextInput label="Código de barras" inputMode="numeric" value={newCode} error={codeError} autoFocus
                  hint="Para corregir o reemplazar el código de este producto." onChange={(e) => { setNewCode(e.target.value); setCodeError(null); }} />
              </div>
              <div className="flex gap-2 sm:mt-[1.625rem]">
                <Button type="submit" variant="primary">Guardar</Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>Cancelar</Button>
              </div>
            </form>
          )}
        </>
      )}
    </article>
  );
}

function UnknownCode({ code, onCreated, onLinked }: { code: string; onCreated: (id: string) => void; onLinked: (id: string) => void }) {
  const { state, actions } = useDemo();
  const [mode, setMode] = useState<"none" | "create" | "link">("none");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ name?: string; category?: string; price?: string; form?: string }>({});
  const [filter, setFilter] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  function create(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!name.trim()) found.name = "Escribí el nombre del producto.";
    if (!categoryId) found.category = "Elegí una categoría.";
    const value = parsePrice(price);
    if (value === null) found.price = "Ingresá un precio entero mayor que 0.";
    setErrors(found);
    if (Object.keys(found).length || value === null) return;
    const result = actions.createProduct({ name: name.trim(), brand: brand.trim(), categoryId, price: value, barcode: code }, "escáner");
    if (typeof result === "object") return setErrors({ form: result.error });
    onCreated(result);
  }

  const candidates = state.products
    .filter((p) => !p.archived && !p.barcode && normalize(`${p.name} ${p.brand}`).includes(normalize(filter)))
    .slice(0, 6);

  function link(id: string) {
    const error = actions.linkBarcode(id, code);
    if (error) return setLinkError(error);
    onLinked(id);
  }

  return (
    <section className={`${CARD_CLASS} p-5`} aria-label="Código desconocido">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-orange/20"><Icon name="alert" className="size-5" /></span>
        <h2 className="text-lg font-semibold">Código no registrado</h2>
        <Badge tone="muted"><span className="tabular-nums">{code}</span></Badge>
      </div>
      <p className="mt-1 text-sm text-brand-muted">
        Ningún producto tiene este código. Podés darlo de alta o vincularlo a uno que todavía no tenga código.
      </p>

      <div className="mt-4 grid gap-2 sm:flex" role="group" aria-label="Qué hacer con el código">
        <Button variant={mode === "create" ? "secondary" : "primary"} icon="plus" className="h-12 sm:h-11" aria-expanded={mode === "create"} onClick={() => setMode(mode === "create" ? "none" : "create")}>
          Dar de alta este producto
        </Button>
        <Button icon="link" className="h-12 sm:h-11" aria-expanded={mode === "link"} onClick={() => setMode(mode === "link" ? "none" : "link")}>
          Vincular a uno existente
        </Button>
      </div>

      {mode === "create" ? (
        <form onSubmit={create} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextInput label="Nombre" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
          <TextInput label="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <SelectInput label="Categoría" value={categoryId} error={errors.category} onChange={(e) => setCategoryId(e.target.value)}>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <TextInput label="Precio (en pesos)" inputMode="numeric" value={price} error={errors.price} onChange={(e) => setPrice(e.target.value)} />
          <TextInput label="Código de barras" value={code} readOnly disabled hint="Viene del escaneo." />
          <div className="flex flex-col justify-end gap-2">
            {errors.form && <p className="text-sm text-brand-danger">{errors.form}</p>}
            <Button type="submit" variant="primary" icon="plus">Crear producto</Button>
          </div>
          <p className="text-xs text-brand-muted sm:col-span-2">
            El producto se crea <strong className="font-medium text-brand-ink">sin publicar</strong> y sin fotos. Un gerente lo revisa y lo publica.
          </p>
        </form>
      ) : mode === "link" ? (
        <div className="mt-4">
          <label htmlFor="filtro-existente" className="mb-1.5 block text-sm font-medium">Buscar producto sin código</label>
          <input id="filtro-existente" value={filter} onChange={(e) => setFilter(e.target.value)} className={INPUT_CLASS} placeholder="Nombre o marca" />
          {linkError && <p className="mt-2 text-sm text-brand-danger">{linkError}</p>}
          {candidates.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">No hay productos sin código que coincidan.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-line rounded-lg border border-brand-line">
              {candidates.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <ProductThumb seed={p.categoryId} className="size-9" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.name}</span><span className="block text-xs text-brand-muted">{p.brand} · {formatPrice(p.price)}</span></span>
                  <Button size="sm" onClick={() => link(p.id)}>Vincular</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
