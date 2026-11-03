// Pruebas del globo y del resaltado de búsqueda. Ejecutar: node --test scripts/site-identity.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCoordinates, graticule, linePath, project, SOUTH_AMERICA } from "../src/lib/geo.ts";
import { highlightParts } from "../src/lib/catalog/highlight.ts";

describe("globo", () => {
  it("el centro de la vista queda en el centro del dibujo", () => {
    const p = project({ lat: -30, lng: -65 });
    assert.deepEqual([p.x, p.y, p.visible], [0, 0, true]);
  });
  it("Río Turbio queda en la cara visible, abajo y a la izquierda del centro", () => {
    const p = project({ lat: -51.533, lng: -72.3 });
    assert.equal(p.visible, true);
    assert.ok(p.y > 0, "más al sur: y positiva");
    assert.ok(p.x < 0, "más al oeste: x negativa");
    assert.ok(Math.hypot(p.x, p.y) < 100, "dentro del círculo");
  });
  it("un punto en las antípodas queda oculto", () => {
    assert.equal(project({ lat: 30, lng: 115 }).visible, false);
  });
  it("las líneas no cruzan por delante lo que está detrás", () => {
    const d = linePath([{ lat: 0, lng: -65 }, { lat: 30, lng: 115 }, { lat: 0, lng: -60 }]);
    assert.equal((d.match(/M/g) ?? []).length, 2);
  });
  it("arma cuadrícula y costa", () => {
    assert.ok(graticule().length > 8);
    assert.ok(linePath(SOUTH_AMERICA, undefined, 100, true).endsWith("Z"));
  });
  it("formatea coordenadas", () => {
    assert.equal(formatCoordinates({ lat: -51.533, lng: -72.3 }), "51°32′S 72°18′O");
    assert.equal(formatCoordinates({ lat: 10.999, lng: 5 }), "11°00′N 5°00′E");
  });
});

describe("resaltado de búsqueda", () => {
  const marks = (parts) => parts.filter((p) => p.match).map((p) => p.text);
  it("sin término no marca nada", () => {
    assert.deepEqual(highlightParts("Balde", undefined), [{ text: "Balde", match: false }]);
    assert.deepEqual(highlightParts("Balde", "  "), [{ text: "Balde", match: false }]);
  });
  it("ignora mayúsculas y tildes y conserva el texto original", () => {
    assert.deepEqual(marks(highlightParts("Plástico Duro", "plastico")), ["Plástico"]);
    assert.deepEqual(marks(highlightParts("Regalería", "ERÍA")), ["ería"]);
  });
  it("marca todas las apariciones y recompone el texto", () => {
    const parts = highlightParts("taza y taza", "taza");
    assert.deepEqual(marks(parts), ["taza", "taza"]);
    assert.equal(parts.map((p) => p.text).join(""), "taza y taza");
  });
  it("si no aparece, devuelve el texto entero", () => {
    assert.deepEqual(highlightParts("Balde", "vaso"), [{ text: "Balde", match: false }]);
  });
});
