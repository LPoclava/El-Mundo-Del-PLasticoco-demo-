// Zona horaria fija: el servidor y el navegador deben mostrar lo mismo.
const TZ = "America/Argentina/Buenos_Aires";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: TZ });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
