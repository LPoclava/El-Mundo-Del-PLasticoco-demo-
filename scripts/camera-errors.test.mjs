// Comprueba que cada error de la cámara muestra un mensaje distinto y acorde (no todo es "permiso denegado").
// Ejecutar: node --test scripts/camera-errors.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CameraSetupError, describeCameraError } from "../src/lib/barcode/camera.ts";

const dom = (name) => new DOMException("x", name);

test("NotAllowedError con permiso bloqueado explica cómo habilitarlo en Chrome", () => {
  const e = describeCameraError(dom("NotAllowedError"), "https://x.test", "denied");
  assert.match(e.title, /bloqueada/);
  assert.ok(e.steps && e.steps.length >= 3);
  assert.match(e.steps.join(" "), /Permisos/);
  assert.match(e.steps.join(" "), /Cámara/);
  assert.equal(e.canRetry, true);
});

test("NotAllowedError con el aviso cerrado (permiso 'prompt') no habla de bloqueo", () => {
  const e = describeCameraError(dom("NotAllowedError"), "", "prompt");
  assert.match(e.title, /No se otorgó/);
  assert.equal(e.steps, undefined);
});

test("NotFoundError: no hay cámara, sin reintento", () => {
  const e = describeCameraError(dom("NotFoundError"));
  assert.match(e.title, /No hay cámara/);
  assert.equal(e.canRetry, false);
});

test("NotReadableError: cámara ocupada, con reintento", () => {
  const e = describeCameraError(dom("NotReadableError"));
  assert.match(e.message, /Otra aplicación/);
  assert.equal(e.canRetry, true);
});

test("contexto inseguro informa la dirección actual y pide HTTPS", () => {
  const e = describeCameraError(new CameraSetupError("insecure", ""), "http://192.168.1.232:3000");
  assert.match(e.title, /HTTPS/);
  assert.match(e.message, /192\.168\.1\.232/);
  assert.equal(e.canRetry, false);
});

test("errores del lector o del video no se presentan como permiso denegado", () => {
  for (const kind of ["decoder", "video", "ended"]) {
    const e = describeCameraError(new CameraSetupError(kind, ""));
    assert.doesNotMatch(e.title + e.message, /permiso|bloquead/i, kind);
    assert.equal(e.canRetry, true);
  }
});

test("un error desconocido tiene mensaje genérico", () => {
  const e = describeCameraError(new Error("raro"));
  assert.match(e.title, /No se pudo iniciar la cámara/);
});

test("los seis tipos dan títulos distintos entre sí", () => {
  const titles = [
    describeCameraError(dom("NotAllowedError"), "", "denied"),
    describeCameraError(dom("NotFoundError")),
    describeCameraError(dom("NotReadableError")),
    describeCameraError(new CameraSetupError("insecure", ""), "o"),
    describeCameraError(new CameraSetupError("decoder", "")),
    describeCameraError(new Error("x")),
  ].map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
});
