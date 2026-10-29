// Pruebas de las reglas de banners. Ejecutar: node --test scripts/banner-rules.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSafeBannerLink, bannerStatus, validateImageFile, validateImageSize, validateBannerForm,
  stepIndex, swipeDirection, toLocalInput, fromLocalInput,
} from "../src/lib/banners/rules.ts";

const form = (over = {}) => ({
  title: "", body: "", badge: "", ctaLabel: "", linkUrl: "", imageAlt: "", startsAt: "", endsAt: "", hasImage: true,
  ...over,
});

describe("enlaces", () => {
  it("acepta rutas internas y https", () => {
    for (const ok of ["/", "/?categoria=cocina", "/?q=balde&categoria=bano", "https://wa.me/5491112345678"]) {
      assert.ok(isSafeBannerLink(ok), ok);
    }
  });
  it("rechaza esquemas peligrosos, // y vacíos", () => {
    for (const bad of ["", "javascript:alert(1)", "http://x.com", "//evil.com", "/\\evil.com", "data:text/html,x", "https://", "/con espacio", "ftp://x.com", "x.com"]) {
      assert.ok(!isSafeBannerLink(bad), bad);
    }
    assert.ok(!isSafeBannerLink("/" + "a".repeat(500)));
  });
});

describe("estado por vigencia", () => {
  const now = Date.parse("2030-06-15T12:00:00Z");
  it("activo, programado, vencido e inactivo", () => {
    assert.equal(bannerStatus({ isActive: true, startsAt: null, endsAt: null }, now), "active");
    assert.equal(bannerStatus({ isActive: true, startsAt: "2030-07-01T00:00:00Z", endsAt: null }, now), "scheduled");
    assert.equal(bannerStatus({ isActive: true, startsAt: null, endsAt: "2030-06-01T00:00:00Z" }, now), "expired");
    assert.equal(bannerStatus({ isActive: false, startsAt: null, endsAt: null }, now), "inactive");
  });
  it("el fin es exclusivo, igual que en la vista pública", () => {
    assert.equal(bannerStatus({ isActive: true, startsAt: null, endsAt: "2030-06-15T12:00:00Z" }, now), "expired");
    assert.equal(bannerStatus({ isActive: true, startsAt: "2030-06-15T12:00:00Z", endsAt: null }, now), "active");
  });
});

describe("imagen", () => {
  it("valida formato y peso", () => {
    assert.equal(validateImageFile({ type: "image/webp", size: 1000 }), null);
    assert.match(validateImageFile({ type: "image/gif", size: 1000 }), /JPG, PNG o WebP/);
    assert.match(validateImageFile({ type: "application/pdf", size: 1000 }), /JPG, PNG o WebP/);
    assert.match(validateImageFile({ type: "image/png", size: 6 * 1024 * 1024 }), /5 MB/);
    assert.match(validateImageFile({ type: "image/png", size: 0 }), /vacío/);
  });
  it("valida tamaño y proporción", () => {
    assert.equal(validateImageSize(1600, 700), null);
    assert.equal(validateImageSize(1200, 500), null);
    assert.match(validateImageSize(600, 260), /muy chica/);
    assert.match(validateImageSize(1000, 1000), /proporción/);
    assert.match(validateImageSize(1600, 400), /proporción/);
    assert.match(validateImageSize(0, 0), /tamaño/);
  });
});

describe("formulario", () => {
  it("sin imagen no se puede publicar", () => {
    assert.ok(validateBannerForm(form({ hasImage: false })).hasImage);
    assert.deepEqual(validateBannerForm(form()), {});
  });
  it("el texto es opcional, pero respeta los largos", () => {
    assert.ok(validateBannerForm(form({ title: "x".repeat(81) })).title);
    assert.ok(validateBannerForm(form({ body: "x".repeat(241) })).body);
    assert.ok(validateBannerForm(form({ badge: "x".repeat(25) })).badge);
    assert.equal(validateBannerForm(form({ title: "x".repeat(80) })).title, undefined);
  });
  it("valida el enlace y exige uno para el botón", () => {
    assert.ok(validateBannerForm(form({ linkUrl: "javascript:alert(1)" })).linkUrl);
    assert.equal(validateBannerForm(form({ linkUrl: "/?categoria=bano" })).linkUrl, undefined);
    assert.ok(validateBannerForm(form({ ctaLabel: "Ver promoción" })).ctaLabel);
    assert.deepEqual(validateBannerForm(form({ ctaLabel: "Ver promoción", linkUrl: "/" })), {});
  });
  it("valida fechas", () => {
    assert.ok(validateBannerForm(form({ startsAt: "2030-02-01T10:00", endsAt: "2030-01-01T10:00" })).endsAt);
    assert.ok(validateBannerForm(form({ startsAt: "2030-01-01T10:00", endsAt: "2030-01-01T10:00" })).endsAt);
    assert.deepEqual(validateBannerForm(form({ startsAt: "2030-01-01T10:00", endsAt: "2030-02-01T10:00" })), {});
    assert.deepEqual(validateBannerForm(form({ endsAt: "2030-02-01T10:00" })), {});
  });
  it("convierte fechas locales de ida y vuelta", () => {
    const iso = fromLocalInput("2030-03-04T05:06");
    assert.equal(toLocalInput(iso), "2030-03-04T05:06");
    assert.equal(fromLocalInput(""), null);
    assert.equal(toLocalInput(null), "");
  });
});

describe("carrusel", () => {
  it("da la vuelta al llegar al final y al principio", () => {
    assert.equal(stepIndex(0, 3, 1), 1);
    assert.equal(stepIndex(2, 3, 1), 0);
    assert.equal(stepIndex(0, 3, -1), 2);
    assert.equal(stepIndex(0, 0, 1), 0);
    assert.equal(stepIndex(0, 1, 1), 0);
  });
  it("interpreta el deslizamiento", () => {
    assert.equal(swipeDirection(-80, 5), 1);
    assert.equal(swipeDirection(80, 5), -1);
    assert.equal(swipeDirection(-20, 0), 0);
    assert.equal(swipeDirection(-60, 70), 0, "un gesto vertical no cambia de banner");
  });
});
