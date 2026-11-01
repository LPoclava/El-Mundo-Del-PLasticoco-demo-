"use client";

import { useState, type FormEvent } from "react";
import { useDemo } from "../demo-provider";
import { Button, CARD_CLASS, DemoBadge, Notice, PageHeader, TextInput } from "../ui";

/** Configuración general de DEMOSTRACIÓN (solo CEO). Nada se guarda. */
export function SettingsSection() {
  const { notify, resetData } = useDemo();
  const [business, setBusiness] = useState("El Mundo del Plástico");
  const [city, setCity] = useState("");
  const [saved, setSaved] = useState(false);

  function save(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    notify("Configuración guardada (simulación).");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Configuración" subtitle="Ajustes generales del negocio y del catálogo. Solo el CEO puede cambiarlos." actions={<DemoBadge>Simulación</DemoBadge>} />

      <section className={`${CARD_CLASS} p-5`} aria-labelledby="negocio-titulo">
        <h2 id="negocio-titulo" className="text-base font-semibold">Datos del negocio</h2>
        <form onSubmit={save} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextInput label="Nombre comercial" value={business} onChange={(e) => { setBusiness(e.target.value); setSaved(false); }} />
          <TextInput label="Localidad" value={city} placeholder="Ej.: Ciudad y provincia" onChange={(e) => { setCity(e.target.value); setSaved(false); }} />
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" variant="primary">Guardar cambios</Button>
            {saved && <span className="text-sm text-brand-green-ink" role="status">Guardado en la demo (no persiste)</span>}
          </div>
        </form>
        <p className="mt-4 text-xs text-brand-muted">
          Los canales de contacto del catálogo público (WhatsApp, teléfono, redes) todavía no se editan desde acá: por ahora los cambia quien administra el sistema.
        </p>
      </section>

      <section className={`${CARD_CLASS} p-5`} aria-labelledby="reglas-titulo">
        <h2 id="reglas-titulo" className="text-base font-semibold">Regla de publicación</h2>
        <p className="mt-1 text-sm text-brand-muted">Un producto se muestra en el catálogo público solo si cumple todo esto. La regla la aplica la base de datos.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {["Está habilitado para publicar", "Tiene una foto principal", "Tiene al menos una variante con precio mayor que 0", "No está archivado"].map((t) => (
            <li key={t} className="flex items-start gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-green" />{t}</li>
          ))}
        </ul>
      </section>

      <section className={`${CARD_CLASS} p-5`} aria-labelledby="seguridad-titulo">
        <h2 id="seguridad-titulo" className="text-base font-semibold">Acceso y seguridad</h2>
        <div className="mt-3">
          <Notice tone="info" title="Todavía no está conectado">
            Esta pantalla es de ejemplo: los permisos y la auditoría definitivos se conectan en una próxima etapa.
          </Notice>
        </div>
      </section>

      <section className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-3 p-5`} aria-labelledby="demo-titulo">
        <div>
          <h2 id="demo-titulo" className="text-base font-semibold">Datos de la demostración</h2>
          <p className="text-sm text-brand-muted">Vuelve los productos, categorías, usuarios y registros al estado inicial.</p>
        </div>
        <Button icon="refresh" onClick={resetData}>Restablecer datos</Button>
      </section>
    </div>
  );
}
