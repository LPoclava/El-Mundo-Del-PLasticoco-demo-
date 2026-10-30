"use client";

import { useParams } from "next/navigation";
import { LinkButton, Notice } from "../ui";
import { ProductEditor } from "./product-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee el id de la dirección (/panel/productos/[id]) en el navegador, donde vive la sesión. */
export function EditProductRoute() {
  const { id } = useParams<{ id: string }>();
  if (!UUID.test(id ?? "")) {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="Ese producto no existe">La dirección está incompleta o el producto fue eliminado.</Notice>
        <LinkButton href="/panel/productos">Volver a productos</LinkButton>
      </div>
    );
  }
  return <ProductEditor productId={id.toLowerCase()} />;
}
