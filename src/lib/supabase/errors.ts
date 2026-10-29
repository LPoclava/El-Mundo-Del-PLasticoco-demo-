/** Traduce los errores de la base y de Storage a mensajes comprensibles. */
export function friendlyError(error: { code?: string; message?: string; statusCode?: string | number } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado.";
  const message = error.message ?? "";
  if (error.code === "42501" || /row-level security|not authorized|No autorizado|permission denied/i.test(message)) {
    return "Tu cuenta no tiene permiso para hacer este cambio.";
  }
  if (error.code === "23514") return "Alguno de los datos no es válido. Revisá el enlace, las fechas y los largos de los textos.";
  if (error.code === "23505" || /already exists|Duplicate/i.test(message)) return "Ese archivo o dato ya está en uso.";
  if (/payload too large|exceeded the maximum allowed size|413/i.test(message) || error.statusCode === "413") {
    return "La imagen es demasiado pesada para el servidor.";
  }
  if (/mime|not supported/i.test(message)) return "El servidor no acepta ese tipo de archivo.";
  if (/fetch|network|Failed to fetch/i.test(message)) return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  return "No se pudo completar la operación. Probá de nuevo; si sigue fallando, avisá a un responsable.";
}
