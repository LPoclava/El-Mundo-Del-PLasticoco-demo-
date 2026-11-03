import {
  BANNER_MAX_OUTPUT_WIDTH, BANNER_MOBILE_MAX_OUTPUT_WIDTH, IMAGE_MAX_BYTES, PRODUCT_MAX_OUTPUT_WIDTH, validateBannerMobileSize,
  validateCategoryImageSize, validateImageFile, productImageWarning, validateImageSize, validateProductImageSize,
} from "./rules";

/** banner = apaisada 16:7; bannerMobile = 4:3 para celular; category = tarjeta casi cuadrada; product = foto casi cuadrada. */
export type ImageKind = "banner" | "bannerMobile" | "category" | "product";

const SIZE_CHECK = {
  banner: validateImageSize,
  bannerMobile: validateBannerMobileSize,
  category: validateCategoryImageSize,
  product: validateProductImageSize,
} as const;
const MAX_WIDTH = { banner: BANNER_MAX_OUTPUT_WIDTH, bannerMobile: BANNER_MOBILE_MAX_OUTPUT_WIDTH, category: BANNER_MAX_OUTPUT_WIDTH, product: PRODUCT_MAX_OUTPUT_WIDTH } as const;

/** Imagen lista para subir: ya validada, reducida si era muy grande y codificada en WebP si el navegador puede. */
export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
  /** Extensión coherente con el tipo final (webp, png o jpg). */
  extension: "webp" | "png" | "jpg";
  /** URL temporal para la vista previa; liberarla con URL.revokeObjectURL. */
  previewUrl: string;
  /** Aviso que NO bloquea la carga (por ejemplo, foto de menos de 800 px). null si no hay nada que avisar. */
  warning: string | null;
};

/** Calidad de WebP: alta, para no degradar ilustraciones y fotos que ya vienen comprimidas. */
const WEBP_QUALITY = 0.92;

const EXTENSION: Record<string, PreparedImage["extension"]> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Se prueba con <img>, que decodifica algunos formatos que createImageBitmap rechaza.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lanza Error con un mensaje para mostrar tal cual a quien administra. */
export async function prepareImage(file: File, kind: ImageKind = "banner"): Promise<PreparedImage> {
  const fileError = validateImageFile(file);
  if (fileError) throw new Error(fileError);

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error("No se pudo leer la imagen. Probá con otro archivo.");
  }

  try {
    const sizeError = SIZE_CHECK[kind](decoded.width, decoded.height);
    if (sizeError) throw new Error(sizeError);

    // Nunca se agranda: solo se reduce lo que supera el máximo útil.
    const scale = Math.min(1, MAX_WIDTH[kind] / decoded.width);
    const width = Math.round(decoded.width * scale);
    const height = Math.round(decoded.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador no puede preparar la imagen.");
    ctx.drawImage(decoded.source, 0, 0, width, height);

    // Un WebP que ya está en tamaño útil se conserva tal cual: volver a comprimirlo con pérdida solo lo degrada.
    const keepOriginal = file.type === "image/webp" && scale === 1;
    const blob = keepOriginal
      ? file
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) throw new Error("No se pudo preparar la imagen. Probá con otro archivo.");
    if (blob.size > IMAGE_MAX_BYTES) throw new Error("La imagen pesa más de 5 MB incluso reducida. Probá con una más liviana.");

    const extension = EXTENSION[blob.type];
    if (!extension) throw new Error("El navegador generó un formato no admitido. Probá con otro navegador.");
    const warning = kind === "product" ? productImageWarning(decoded.width, decoded.height) : null;
    return { blob, width, height, extension, previewUrl: URL.createObjectURL(blob), warning };
  } finally {
    decoded.close();
  }
}
