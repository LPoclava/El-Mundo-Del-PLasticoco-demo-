"use client";

import { useState, type FormEvent } from "react";
import { parsePrice } from "@/lib/panel-demo/store";
import type { DemoProduct } from "@/lib/panel-demo/types";
import { useDemo } from "../demo-provider";
import { Button, Dialog, SelectInput, TextInput } from "../ui";

/** Alta y edición simuladas de un producto (panel lateral). */
export function ProductFormSheet({ product, open, onClose }: { product: DemoProduct | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={product ? "Editar producto" : "Crear producto"}
      description="Simulación: los cambios solo existen en esta demostración."
    >
      {/* Se remonta al abrir para empezar con los datos correctos. */}
      <ProductFormBody key={product?.id ?? "nuevo"} product={product} onDone={onClose} />
    </Dialog>
  );
}

function ProductFormBody({ product, onDone }: { product: DemoProduct | null; onDone: () => void }) {
  const { state, actions, notify } = useDemo();
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? state.categories[0]?.id ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [errors, setErrors] = useState<{ name?: string; category?: string; price?: string; barcode?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!name.trim()) found.name = "Escribí el nombre del producto.";
    if (!categoryId) found.category = "Elegí una categoría.";
    const value = parsePrice(price);
    if (value === null) found.price = "Ingresá un precio entero mayor que 0, sin centavos.";
    setErrors(found);
    if (Object.keys(found).length || value === null) return;

    const code = barcode.trim() || null;
    if (product) {
      const error = actions.updateProduct(product.id, { name: name.trim(), brand: brand.trim(), categoryId, price: value, barcode: code });
      if (error) return setErrors({ barcode: error });
      notify("Producto actualizado (simulación).");
    } else {
      const result = actions.createProduct({ name: name.trim(), brand: brand.trim(), categoryId, price: value, barcode: code }, "panel");
      if (typeof result === "object") return setErrors({ barcode: result.error });
      notify("Producto creado sin publicar (simulación).");
    }
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextInput label="Nombre" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} autoFocus />
      <TextInput label="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <SelectInput label="Categoría" value={categoryId} error={errors.category} onChange={(e) => setCategoryId(e.target.value)}>
        {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectInput>
      <TextInput label="Precio (en pesos)" inputMode="numeric" value={price} error={errors.price} onChange={(e) => setPrice(e.target.value)} hint="Pesos enteros, sin centavos." />
      <TextInput label="Código de barras (opcional)" inputMode="numeric" value={barcode} error={errors.barcode} onChange={(e) => setBarcode(e.target.value)} hint="De 8 a 14 dígitos. No puede repetirse." />
      {!product && (
        <p className="text-xs text-brand-muted">El producto nuevo queda sin publicar; para publicarlo hace falta una foto principal y un precio válido.</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary">{product ? "Guardar cambios" : "Crear producto"}</Button>
      </div>
    </form>
  );
}
