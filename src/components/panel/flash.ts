/**
 * Aviso que sobrevive a un cambio de pantalla: al guardar en una pantalla de edición se vuelve al listado y
 * el aviso «Guardado» se muestra ahí. Vive en sessionStorage (solo esta pestaña) y se lee una sola vez.
 */
const KEY = "mp-panel-flash";

export type Flash = { message: string; tone: "ok" | "error" };

export function setFlash(flash: Flash): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flash));
  } catch {
    // Sin almacenamiento (modo privado estricto) se pierde el aviso, no el guardado.
  }
}

export function takeFlash(): Flash | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Flash>;
    return typeof value.message === "string" ? { message: value.message, tone: value.tone === "error" ? "error" : "ok" } : null;
  } catch {
    return null;
  }
}
