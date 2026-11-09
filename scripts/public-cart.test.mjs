// Pruebas del carrito público. Ejecutar: node --test scripts/public-cart.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addLine, setLineQuantity, removeLine, cartTotal, cartUnits, lineSubtotal, serializeCart, parseCart, cartInquiryText,
  MAX_QUANTITY, MAX_LINES, STORAGE_KEY, MAX_MESSAGE_LENGTH,
} from "../src/lib/cart/public-cart.ts";

const line = (over = {}) => ({
  productId: "p1", variantId: "v1", name: "Balde 10L", variantLabel: "Azul", unitPrice: 1000, imageUrl: null, path: "/producto/balde-10l-ab12", ...over,
});

describe("agregar y cantidades", () => {
  it("crea la línea con 1 unidad y suma si la variante ya está", () => {
    let r = addLine([], line());
    assert.equal(r.status, "added");
    r = addLine(r.cart, line());
    assert.equal(r.status, "increased");
    assert.equal(r.cart.length, 1);
    assert.equal(r.cart[0].quantity, 2);
  });

  it("variantes distintas son líneas distintas; sin variante se identifica por producto", () => {
    let c = addLine([], line()).cart;
    c = addLine(c, line({ variantId: "v2", variantLabel: "Rojo" })).cart;
    c = addLine(c, line({ productId: "p2", variantId: null, variantLabel: null })).cart;
    assert.deepEqual(c.map((l) => l.key), ["v1", "v2", "p2"]);
  });

  it("no pasa del máximo por línea ni de la cantidad de líneas", () => {
    let c = addLine([], line(), MAX_QUANTITY).cart;
    const r = addLine(c, line());
    assert.equal(r.status, "capped");
    assert.equal(r.cart[0].quantity, MAX_QUANTITY);
    let many = [];
    for (let i = 0; i < MAX_LINES; i++) many = addLine(many, line({ productId: `p${i}`, variantId: `v${i}` })).cart;
    assert.equal(addLine(many, line({ productId: "x", variantId: "x" })).status, "full");
  });

  it("cambiar cantidad: acota a 1–99 y menos de 1 quita la línea", () => {
    const c = addLine([], line()).cart;
    assert.equal(setLineQuantity(c, "v1", 5)[0].quantity, 5);
    assert.equal(setLineQuantity(c, "v1", 500)[0].quantity, MAX_QUANTITY);
    assert.equal(setLineQuantity(c, "v1", 0).length, 0);
    assert.equal(setLineQuantity(c, "v1", Number.NaN).length, 0);
    assert.equal(setLineQuantity(c, "otra", 3)[0].quantity, 1);
    assert.equal(removeLine(c, "v1").length, 0);
  });

  it("subtotales, total y unidades", () => {
    let c = addLine([], line(), 3).cart;
    c = addLine(c, line({ variantId: "v2", unitPrice: 250 }), 2).cart;
    assert.equal(lineSubtotal(c[0]), 3000);
    assert.equal(cartTotal(c), 3500);
    assert.equal(cartUnits(c), 5);
    assert.equal(cartTotal([]), 0);
  });
});

describe("persistencia", () => {
  it("ida y vuelta conserva todo", () => {
    const c = addLine(addLine([], line(), 2).cart, line({ productId: "p2", variantId: null, variantLabel: null, imageUrl: "https://x.test/a.webp" })).cart;
    assert.deepEqual(parseCart(serializeCart(c)), c);
    assert.equal(STORAGE_KEY, "mp-cart");
  });

  it("lo dañado, vacío o de otra versión da un carrito vacío", () => {
    for (const raw of [null, "", "no es json", "{}", "[]", '{"v":2,"lines":[]}', '{"v":1,"lines":"x"}', "x".repeat(200_000)]) {
      assert.deepEqual(parseCart(raw), []);
    }
  });

  it("descarta líneas inválidas sin perder las buenas", () => {
    const good = { ...line(), key: "v1", quantity: 2 };
    const bad = [
      { ...good, productId: 5 }, { ...good, unitPrice: -1 }, { ...good, unitPrice: 10.5 }, { ...good, quantity: 0 },
      { ...good, path: "https://malo.test/" }, { ...good, path: "//malo.test" }, { ...good, name: "" }, { ...good, variantId: 3 },
    ];
    const parsed = parseCart(JSON.stringify({ v: 1, lines: [...bad, good, { ...good }] }));
    assert.equal(parsed.length, 1, "además no duplica la clave");
    assert.equal(parsed[0].quantity, 2);
  });

  it("acota una cantidad guardada fuera de rango", () => {
    const parsed = parseCart(JSON.stringify({ v: 1, lines: [{ ...line(), quantity: 5000 }] }));
    assert.equal(parsed[0].quantity, MAX_QUANTITY);
  });
});

describe("mensaje de WhatsApp", () => {
  const cart = addLine(addLine([], line(), 2).cart, line({ productId: "p2", variantId: null, variantLabel: null, name: "Vaso largo", unitPrice: 500 })).cart;

  it("lista cantidad, producto, variante, precio, subtotal, enlace y total", () => {
    const text = cartInquiryText(cart, "https://sitio.test");
    assert.match(text, /• 2 × Balde 10L \(Azul\) — \$\s?1\.000 c\/u — \$\s?2\.000/);
    assert.match(text, /• 1 × Vaso largo — \$\s?500 c\/u — \$\s?500/);
    assert.ok(text.includes("https://sitio.test/producto/balde-10l-ab12"));
    assert.match(text, /Total estimado: \$\s?2\.500/);
  });

  it("no promete una compra: pide confirmar disponibilidad y precio final", () => {
    const text = cartInquiryText(cart, null);
    assert.match(text, /confirman disponibilidad, precio final/);
    assert.doesNotMatch(text, /compra confirmada|pagado|reserv/i);
    assert.doesNotMatch(text, /https?:/, "sin dominio conocido no inventa enlaces");
  });

  it("un pedido de 50 líneas supera el largo permitido (la pantalla avisa y no abre WhatsApp); uno normal no", () => {
    let big = [];
    for (let i = 0; i < MAX_LINES; i++) big = addLine(big, line({ productId: `p${i}`, variantId: `v${i}`, name: `Producto número ${i}` })).cart;
    assert.ok(cartInquiryText(big, "https://sitio.test").length > MAX_MESSAGE_LENGTH);
    assert.ok(cartInquiryText(cart, "https://sitio.test").length < MAX_MESSAGE_LENGTH);
  });
});

describe("conexión con el sitio", () => {
  const read = (...p) => readFileSync(join(import.meta.dirname, "..", ...p), "utf8");

  it("el carrito no envía nada al servidor: ni la lógica ni el proveedor usan la base ni escriben datos", () => {
    const lib = read("src", "lib", "cart", "public-cart.ts");
    const provider = read("src", "components", "cart", "cart-provider.tsx");
    for (const src of [lib, provider]) assert.doesNotMatch(src, /supabase|fetch\(|\.rpc\(|\.insert\(|\.update\(/);
  });

  it("el panel lateral termina solo en WhatsApp y aclara que no es una compra", () => {
    const drawer = read("src", "components", "cart", "cart-drawer.tsx");
    assert.ok(drawer.includes("generalInquiryHref(") && drawer.includes("No es una compra"));
    assert.doesNotMatch(drawer, /confirm_sale|pagar|checkout/i);
  });

  it("el carrito está disponible en tarjeta, ficha y navegación", () => {
    assert.ok(read("src", "app", "(site)", "layout.tsx").includes("<CartProvider>"));
    assert.ok(read("src", "components", "site-header.tsx").includes("<CartButton />"));
    assert.ok(read("src", "components", "catalog", "product-card.tsx").includes("<AddToCartButton"));
    assert.ok(read("src", "components", "product", "product-purchase.tsx").includes("Agregar al pedido"));
  });

  it("respeta reducir movimiento", () => {
    const css = read("src", "app", "globals.css");
    assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*\.cart-toast, \.cart-bump \{ animation: none/);
  });
});
