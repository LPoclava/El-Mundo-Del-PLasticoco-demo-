/**
 * Acceso a la cámara (solo navegador). Usa únicamente la API estándar
 * navigator.mediaDevices.getUserMedia: nada que evite o simule los permisos del navegador.
 */

export type Facing = "environment" | "user";

export type SetupErrorKind = "insecure" | "unsupported" | "decoder" | "ended" | "video";

export class CameraSetupError extends Error {
  readonly kind: SetupErrorKind;
  constructor(kind: SetupErrorKind, message: string) {
    super(message);
    this.name = "CameraSetupError";
    this.kind = kind;
  }
}

/**
 * Pide la cámara. Debe llamarse DENTRO del manejador de un clic o toque (sin await antes):
 * así la solicitud nace de una acción directa del usuario. Prefiere la cámara trasera.
 */
export function requestCamera(facing: Facing): Promise<MediaStream> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return Promise.reject(new CameraSetupError("insecure", "contexto no seguro"));
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new CameraSetupError("unsupported", "sin getUserMedia"));
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

/** Libera la cámara: detiene todas las pistas del MediaStream. */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Estado del permiso de cámara según Chrome (la Permissions API puede no existir: devuelve null). */
export async function readCameraPermission(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name: "camera" as PermissionName });
    return status?.state ?? null;
  } catch {
    return null;
  }
}

export type CameraError = {
  title: string;
  message: string;
  /** Pasos a seguir, si los hay. */
  steps?: string[];
  canRetry: boolean;
};

/**
 * Convierte un error en un mensaje acorde al caso: no todo error es "permiso denegado".
 * `permission` es el estado del permiso al fallar (si se pudo consultar).
 */
export function describeCameraError(error: unknown, origin = "", permission: PermissionState | null = null): CameraError {
  if (error instanceof CameraSetupError) {
    switch (error.kind) {
      case "insecure":
        return {
          title: "La cámara necesita una conexión segura (HTTPS)",
          message: `Estás en «${origin}». Chrome solo habilita la cámara en páginas https:// o en localhost. Abrí la demo con una dirección https o seguí docs/demo-escaner-celular.md.`,
          canRetry: false,
        };
      case "unsupported":
        return { title: "Este navegador no permite usar la cámara", message: "Probá con Google Chrome actualizado. Mientras tanto podés ingresar el código a mano.", canRetry: false };
      case "decoder":
        return { title: "No se pudo iniciar el lector de códigos", message: "La cámara funciona, pero no se cargó el componente que lee los códigos. Revisá tu conexión y tocá «Reintentar».", canRetry: true };
      case "ended":
        return { title: "La cámara se detuvo", message: "Chrome la cerró (por ejemplo, al cambiar de aplicación o pestaña). Tocá «Reintentar» para volver a abrirla.", canRetry: true };
      case "video":
        return { title: "No se pudo mostrar la vista previa", message: "La cámara se abrió pero el video no arrancó. Tocá «Reintentar».", canRetry: true };
    }
  }

  const name = error instanceof DOMException || (error instanceof Error && error.name) ? (error as Error).name : "";
  switch (name) {
    case "NotAllowedError":
      // Si Chrome todavía "pregunta", el aviso se cerró sin elegir; si dice "denied", hay un bloqueo guardado.
      if (permission === "prompt") {
        return {
          title: "No se otorgó el permiso de la cámara",
          message: "Se cerró el aviso sin elegir «Permitir». Tocá «Reintentar» y elegí «Permitir» cuando Chrome pregunte.",
          canRetry: true,
        };
      }
      return {
        title: "Chrome tiene bloqueada la cámara para este sitio",
        message: "Para habilitarla en Google Chrome:",
        steps: [
          "Tocá el ícono a la izquierda de la dirección (candado o ajustes).",
          "Entrá en «Permisos» (o «Configuración del sitio») y poné «Cámara» en «Permitir».",
          "Volvé a esta página y tocá «Reintentar».",
          "Si sigue bloqueada, en Android abrí Ajustes → Aplicaciones → Chrome → Permisos → Cámara y elegí «Permitir».",
        ],
        canRetry: true,
      };
    case "SecurityError":
      return { title: "El navegador bloqueó la cámara por seguridad", message: "La página no tiene permiso para usar la cámara en este contexto. Abrila directamente en Chrome, con https://.", canRetry: false };
    case "NotFoundError":
      return { title: "No hay cámara disponible", message: "Chrome no encontró una cámara compatible en este dispositivo. Podés ingresar el código a mano.", canRetry: false };
    case "NotReadableError":
    case "AbortError":
      return { title: "No se pudo usar la cámara", message: "Otra aplicación o pestaña la está usando, o falló el hardware. Cerrala y tocá «Reintentar».", canRetry: true };
    case "OverconstrainedError":
      return { title: "La cámara no admite la configuración pedida", message: "Tocá «Reintentar». Si se repite, probá con la otra cámara o ingresá el código a mano.", canRetry: true };
    default:
      return { title: "No se pudo iniciar la cámara", message: "Ocurrió un error inesperado. Probá de nuevo o ingresá el código a mano.", canRetry: true };
  }
}
