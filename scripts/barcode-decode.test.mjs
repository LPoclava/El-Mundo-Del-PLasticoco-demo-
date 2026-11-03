// Comprueba, sin cámara, que el decodificador elegido (@zxing/library) lee códigos EAN/UPC dibujados
// con nuestro codificador, incluso con desenfoque, rotación y poco tamaño.
// NO prueba la cámara real ni el navegador del celular: eso solo se verifica en un teléfono.
// Ejecutar: node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatOneDReader, RGBLuminanceSource,
} from "@zxing/library";
import { ean13, ean13Modules, hasValidCheckDigit } from "../src/lib/barcode/ean.ts";

function svgFor(code, module = 4) {
  const bits = ean13Modules(code);
  const quiet = 10;
  const width = (bits.length + quiet * 2) * module;
  const height = 120 * (module / 2);
  let bars = "";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") bars += `<rect x="${(i + quiet) * module}" y="10" width="${module}" height="${height - 20}" fill="#000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${bars}</svg>`;
}

async function decode(image) {
  const { data, info } = await image.greyscale().raw().toBuffer({ resolveWithObject: true });
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new MultiFormatOneDReader(hints);
  const source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
  try {
    const result = reader.decode(new BinaryBitmap(new HybridBinarizer(source)), hints);
    return { text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] };
  } catch {
    return null;
  }
}

const CODES = ["4006381333931", ean13("200000100001"), ean13("200000100009")];

for (const code of CODES) {
  test(`lee ${code} limpio`, async () => {
    const r = await decode(sharp(Buffer.from(svgFor(code))));
    assert.deepEqual(r, { text: code, format: "EAN_13" });
  });

  test(`lee ${code} reducido, con desenfoque y girado 4°`, async () => {
    const img = sharp(Buffer.from(svgFor(code, 3)))
      .resize({ width: 320 })
      .blur(1.1)
      .rotate(4, { background: "#fff" });
    const r = await decode(img);
    assert.equal(r?.text, code);
  });
}

test("no inventa un código donde no hay ninguno", async () => {
  const blank = sharp({ create: { width: 400, height: 200, channels: 3, background: "#ccc" } }).png();
  assert.equal(await decode(blank), null);
});

test("el dígito verificador descarta lecturas con un dígito cambiado", () => {
  assert.equal(hasValidCheckDigit("4006381333931"), true);
  assert.equal(hasValidCheckDigit("4006381333932"), false);
  assert.equal(hasValidCheckDigit("4006381333831"), false);
});
