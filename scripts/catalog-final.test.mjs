// Pruebas de las reglas agregadas en la intervención final. Ejecutar: npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { displayName, slugify } from "../src/lib/catalog/product.ts";
import {
  BANNER_MOBILE_RATIO, BANNER_RATIO, isSafeBannerLink, validateBannerMobileSize,
} from "../src/lib/banners/rules.ts";

describe("nombre para mostrar", () => {
  it("pone mayúscula inicial sin tocar el resto", () => {
    assert.equal(displayName("palitos"), "Palitos");
    assert.equal(displayName("Termos 700ml"), "Termos 700ml");
    assert.equal(displayName("  árbol de Navidad "), "Árbol de Navidad");
    assert.equal(displayName("80x90"), "80x90");
    assert.equal(displayName(""), "");
  });
  it("no cambia la dirección del producto", () => {
    assert.equal(slugify(displayName("palitos")), slugify("palitos"));
  });
});

describe("banner para celular", () => {
  it("acepta el tamaño recomendado y una proporción cercana", () => {
    assert.equal(validateBannerMobileSize(1200, 900), null);
    assert.equal(validateBannerMobileSize(800, 600), null);
  });
  it("rechaza imágenes chicas o con la proporción apaisada", () => {
    assert.match(validateBannerMobileSize(400, 300), /muy chica/);
    assert.match(validateBannerMobileSize(1600, 700), /proporción/);
    assert.match(validateBannerMobileSize(900, 1600), /proporción/);
    assert.match(validateBannerMobileSize(0, 0), /No se pudo leer/);
  });
  it("es más alto que el apaisado", () => {
    assert.ok(BANNER_MOBILE_RATIO < BANNER_RATIO);
  });
  it("los destinos pedidos para los banners son válidos", () => {
    assert.equal(isSafeBannerLink("/?q=termos"), true);
    assert.equal(isSafeBannerLink("/#catalogo"), true);
  });
});
