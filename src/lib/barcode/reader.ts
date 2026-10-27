/**
 * Lectura de códigos de barras desde un fotograma (solo navegador).
 * - Si el navegador trae BarcodeDetector con EAN-13, lo usa (rápido, nativo).
 * - Si no, o si falla, usa @zxing/library (JavaScript puro): funciona en cualquier navegador móvil moderno.
 * Formatos: EAN-13, EAN-8, UPC-A, UPC-E y Code 128.
 */
import { hasValidCheckDigit } from "./ean";

export type Reading = { value: string; format: string };

export type Decoder = {
  engine: "native" | "zxing";
  decode: (frame: HTMLCanvasElement) => Promise<Reading | null>;
};

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

type NativeDetector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string; format: string }[]> };
type NativeConstructor = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

async function createZxingDecoder(): Promise<Decoder> {
  // Se carga solo al abrir la cámara: no pesa en el resto del panel.
  const z = await import("@zxing/library");
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>([
    [z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13, z.BarcodeFormat.EAN_8, z.BarcodeFormat.UPC_A, z.BarcodeFormat.UPC_E, z.BarcodeFormat.CODE_128]],
    [z.DecodeHintType.TRY_HARDER, true],
  ]);
  // Solo lectores de una dimensión: más rápido que MultiFormatReader, que además prueba QR, Aztec, etc.
  const reader = new z.MultiFormatOneDReader(hints);
  return {
    engine: "zxing",
    decode: async (frame) => {
      try {
        const bitmap = new z.BinaryBitmap(new z.HybridBinarizer(new z.HTMLCanvasElementLuminanceSource(frame)));
        const result = reader.decode(bitmap, hints);
        return { value: result.getText(), format: z.BarcodeFormat[result.getBarcodeFormat()].toLowerCase() };
      } catch {
        return null; // fotograma sin código legible: es lo normal
      }
    },
  };
}

async function createNativeDecoder(): Promise<Decoder | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeConstructor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = await Ctor.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    if (!formats.includes("ean_13")) return null;
    const detector = new Ctor({ formats });
    let fallback: Decoder | null = null;
    return {
      engine: "native",
      decode: async (frame) => {
        if (!fallback) {
          try {
            const [first] = await detector.detect(frame);
            return first ? { value: first.rawValue, format: first.format } : null;
          } catch {
            // El detector nativo falló en este dispositivo: se pasa a ZXing y no se vuelve a usar.
            fallback = await createZxingDecoder();
          }
        }
        return fallback.decode(frame);
      },
    };
  } catch {
    return null;
  }
}

export async function createDecoder(): Promise<Decoder> {
  return (await createNativeDecoder()) ?? (await createZxingDecoder());
}

export type Accepted = { ok: true; code: string } | { ok: false; reason: string };

/**
 * Decide si una lectura sirve como código de producto. Las cámaras a veces leen mal un dígito:
 * en EAN/UPC el dígito verificador permite descartar esas lecturas.
 */
export function acceptReading(reading: Reading): Accepted {
  const value = reading.value.trim();
  if (!/^\d{8,14}$/.test(value)) return { ok: false, reason: `Se leyó «${value}», que no es un código de producto.` };
  const checked = ["ean_13", "ean_8", "upc_a"].includes(reading.format);
  if (checked && !hasValidCheckDigit(value)) return { ok: false, reason: "Lectura dudosa: volvé a enfocar el código." };
  return { ok: true, code: value };
}
