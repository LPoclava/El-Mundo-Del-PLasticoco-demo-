// Fase 0.4: pruebas de la parte del circuito de venta que vive en el navegador (lógica pura, sin red ni React).
// Ejecutar: node --test scripts/pos-circuito.test.mjs
// Complementa pos-cart, pos-draft y pos-stock (no los reemplaza). La validación definitiva de precios, stock y total
// ocurre en PostgreSQL y se prueba en supabase/tests (pos-ventas, pos-integridad y concurrency).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeSaleError } from "../src/lib/pos/errors.ts";
import { isBarcode, sellable, toCartLine, variantLabel } from "../src/lib/pos/sellable.ts";
import { RECEIPT_NOTICE, BUSINESS_NAME, receiptHeader, receiptText, saleToReceipt, receiptDocumentTitle } from "../src/lib/pos/receipt.ts";
import {
  addToCart, applyProblems, attemptSignature, cartIssues, cartTotal, describeProblem, parseQuantity,
} from "../src/lib/pos/cart.ts";

const product = (over = {}) => ({
  productId: "p1", name: "Balde", brand: null, description: null, barcode: "7791111000011", imagePath: null, archived: false,
  variants: [{ id: "v1", size: null, color: null, price: 1000, stock: 5 }], ...over,
});

describe("qué se ofrece para vender", () => {
  const p = product();
  const v = p.variants[0];

  it("una variante con precio y stock se puede vender", () => {
    assert.equal(sellable(p, v), true);
  });

  for (const [nombre, prod, variante] of [
    ["sin stock", p, { ...v, stock: 0 }],
    ["con stock negativo (dato corrupto)", p, { ...v, stock: -1 }],
    ["sin precio", p, { ...v, price: null }],
    ["con precio cero", p, { ...v, price: 0 }],
    ["con precio negativo", p, { ...v, price: -10 }],
    ["de un producto archivado", product({ archived: true }), v],
  ]) {
    it(`no se ofrece una variante ${nombre}`, () => {
      assert.equal(sellable(prod, variante), false);
    });
  }

  it("la línea del carrito copia el precio y el stock que vio quien vende", () => {
    const line = toCartLine(p, { id: "v9", size: "M", color: "Azul", price: 2500, stock: 3 });
    assert.deepEqual(
      [line.variantId, line.productId, line.name, line.variantLabel, line.barcode, line.unitPrice, line.stock],
      ["v9", "p1", "Balde", "M · Azul", "7791111000011", 2500, 3],
    );
  });

  it("variantLabel junta tamaño y color, o es nulo si no hay atributos", () => {
    assert.equal(variantLabel({ size: "M", color: null }), "M");
    assert.equal(variantLabel({ size: null, color: "Azul" }), "Azul");
    assert.equal(variantLabel({ size: null, color: null }), null);
  });

  it("isBarcode: solo 8 a 14 dígitos; el resto se busca como nombre", () => {
    for (const ok of ["12345678", "7791111000011", "12345678901234", " 7791111000011 "]) assert.equal(isBarcode(ok), true, ok);
    for (const no of ["1234567", "123456789012345", "77911110000AB", "balde", "", "7791 111000011"]) assert.equal(isBarcode(no), false, no);
  });
});

describe("carrito: entradas inválidas y límites", () => {
  const line = { variantId: "v1", productId: "p1", name: "Balde", variantLabel: null, barcode: null, imagePath: null, unitPrice: 1000, stock: 5 };

  it("carrito vacío: no hay problemas que mostrar pero tampoco total", () => {
    assert.deepEqual(cartIssues([]), []);
    assert.equal(cartTotal([]), 0);
  });

  it("no se agrega un producto sin stock", () => {
    const r = addToCart([], { ...line, stock: 0 });
    assert.equal(r.added, false);
    assert.equal(r.reason, "no-stock");
    assert.deepEqual(r.cart, []);
  });

  it("no se supera el stock al sumar de a poco ni al sumar de golpe", () => {
    let r = addToCart([], line, 5);
    assert.equal(r.cart[0].quantity, 5);
    r = addToCart(r.cart, line, 1);
    assert.equal(r.added, false);
    assert.equal(r.reason, "max-stock");
    assert.equal(r.cart[0].quantity, 5);
    assert.equal(addToCart([], line, 99).cart[0].quantity, 5, "pedir 99 con stock 5 deja 5");
  });

  it("parseQuantity rechaza cero, negativos, decimales, texto y más de 9999", () => {
    for (const bad of ["0", "-1", "1.5", "1,5", "abc", "", " ", "10000", "00", "1e3", "+2"]) assert.equal(parseQuantity(bad), null, JSON.stringify(bad));
    assert.equal(parseQuantity("1"), 1);
    assert.equal(parseQuantity("9999"), 9999);
    assert.equal(parseQuantity(" 12 "), 12);
  });

  it("cartIssues marca cantidad inválida, stock insuficiente, sin stock y precio inválido, sin mezclar líneas", () => {
    const issues = cartIssues([
      { ...line, variantId: "a", quantity: 0 },
      { ...line, variantId: "b", quantity: 6 },
      { ...line, variantId: "c", quantity: 1, stock: 0 },
      { ...line, variantId: "d", quantity: 1, unitPrice: 0 },
      { ...line, variantId: "e", quantity: 2 },
    ]);
    assert.deepEqual(issues.map((i) => i.variantId), ["a", "b", "c", "d"]);
    assert.match(issues[1].message, /5 en stock/);
    assert.match(issues[2].message, /Sin stock/);
  });

  it("un carrito con problemas no debe enviarse: el total sigue calculándose pero cartIssues no está vacío", () => {
    const cart = [{ ...line, quantity: 6 }];
    assert.ok(cartIssues(cart).length > 0);
    assert.equal(cartTotal(cart), 6000);
  });
});

describe("recuperación: qué se le dice a quien vende según lo que respondió la base", () => {
  it("rechazo de la base: no se registró nada, se explican los problemas y se puede corregir", () => {
    const f = describeSaleError({
      code: "P0001", message: "SALE_REJECTED",
      details: JSON.stringify({ problems: [{ reason: "INSUFFICIENT_STOCK", variant_id: "v1", name: "Balde", available: 2, requested: 3 }] }),
    });
    assert.equal(f.kind, "rejected");
    assert.match(f.message, /no se registró/i);
    assert.equal(f.problems.length, 1);
    assert.match(describeProblem(f.problems[0]), /hay 2 y pediste 3/);
  });

  it("rechazo con detalle ilegible: sigue siendo un rechazo (no se confunde con un corte de red)", () => {
    for (const details of ["no es json", null, undefined, "{}", '{"problems": 5}']) {
      const f = describeSaleError({ code: "P0001", message: "SALE_REJECTED", details });
      assert.equal(f.kind, "rejected", String(details));
    }
  });

  it("sin permiso (cuenta desactivada, sin perfil o sesión sin usuario): se avisa y no se invita a reintentar", () => {
    for (const e of [{ code: "42501", message: "No autorizado" }, { message: "permission denied for table sales" }, { message: "new row violates row-level security policy" }]) {
      const f = describeSaleError(e);
      assert.equal(f.kind, "forbidden");
      assert.doesNotMatch(f.message, /reintentar/i);
    }
  });

  it("datos inválidos (22023): se pide revisar el carrito", () => {
    assert.equal(describeSaleError({ code: "22023", message: "Línea de venta inválida" }).kind, "invalid");
  });

  it("corte de red, sin respuesta o error desconocido: NO se sabe si se registró, y se invita a reintentar con la misma clave", () => {
    for (const e of [null, undefined, { message: "Failed to fetch" }, { message: "TypeError: NetworkError" }, { code: "XX001", message: "FALLA_SIMULADA" }, { code: "57014", message: "canceling statement due to timeout" }, {}]) {
      const f = describeSaleError(e);
      assert.equal(f.kind, "unknown", JSON.stringify(e));
      assert.match(f.message, /Reintentar registro/);
      assert.match(f.message, /no se duplica/);
    }
  });

  it("tras un rechazo por precio o stock el carrito se corrige sin vaciarse", () => {
    const cart = [{ variantId: "v1", productId: "p1", name: "Balde", variantLabel: null, barcode: null, imagePath: null, unitPrice: 1000, stock: 5, quantity: 3 }];
    const price = applyProblems(cart, [{ reason: "PRICE_CHANGED", variant_id: "v1", price: 1200 }]);
    assert.equal(price[0].unitPrice, 1200);
    assert.equal(price[0].quantity, 3);
    const stock = applyProblems(cart, [{ reason: "INSUFFICIENT_STOCK", variant_id: "v1", available: 2, requested: 3 }]);
    assert.equal(stock[0].stock, 2);
    assert.equal(cartIssues(stock).length, 1, "ahora el carrito marca que hay que bajar la cantidad");
  });

  it("la clave de operación cambia con cualquier edición y se conserva si nada cambió (reintento seguro)", () => {
    const base = [{ variantId: "v1", productId: "p1", name: "B", variantLabel: null, barcode: null, imagePath: null, unitPrice: 1000, stock: 5, quantity: 2 }];
    const sig = attemptSignature(base, "efectivo");
    assert.equal(attemptSignature(structuredClone(base), "efectivo"), sig, "mismo carrito y medio: misma firma, mismo reintento");
    assert.notEqual(attemptSignature(base, "debito"), sig, "otro medio de pago: otra venta");
    assert.notEqual(attemptSignature([{ ...base[0], quantity: 3 }], "efectivo"), sig, "otra cantidad: otra venta");
    assert.notEqual(attemptSignature([{ ...base[0], unitPrice: 1100 }], "efectivo"), sig, "otro precio: otra venta");
    assert.notEqual(attemptSignature([...base, { ...base[0], variantId: "v2" }], "efectivo"), sig, "otra línea: otra venta");
  });
});

describe("comprobante interno", () => {
  const receipt = {
    number: 42,
    createdAt: "2026-11-08T15:30:00.000Z",
    userName: "Empleada Uno",
    paymentLabel: "Tarjeta de débito",
    total: 7500,
    items: [
      { productName: "Balde reforzado 10L", variantLabel: null, quantity: 3, unitPrice: 1000, subtotal: 3000 },
      { productName: "Remera lisa", variantLabel: "M · Azul", quantity: 1, unitPrice: 4500, subtotal: 4500 },
    ],
  };
  const text = receiptText(receipt, { address: "Bº Los Lupinos, Mza. 103, Lote 1", locality: "Río Turbio, Santa Cruz" });
  const lines = text.split("\n");

  it("identifica al negocio: nombre, dirección y localidad", () => {
    assert.deepEqual(lines.slice(0, 3), [BUSINESS_NAME, "Bº Los Lupinos, Mza. 103, Lote 1", "Río Turbio, Santa Cruz"]);
    assert.deepEqual(receiptHeader(), [BUSINESS_NAME], "sin datos de contacto lleva al menos el nombre");
    assert.deepEqual(receiptHeader({ address: null, locality: "Río Turbio" }), [BUSINESS_NAME, "Río Turbio"]);
  });

  it("lleva número, fecha y hora, medio de pago y quién atendió", () => {
    assert.ok(lines.includes("Comprobante de venta #42"));
    assert.ok(lines.some((l) => /\d{1,2}\/\d{1,2}\/\d{2,4}.*\d{1,2}:\d{2}/.test(l)), "fecha y hora");
    assert.ok(lines.includes("Medio de pago: Tarjeta de débito"));
    assert.ok(lines.includes("Atendió: Empleada Uno"));
  });

  it("cada renglón muestra cantidad, producto, variante e importe (el formato lo fija también pos-draft.test.mjs)", () => {
    const renglones = lines.filter((l) => l.includes("×"));
    assert.equal(renglones.length, 2);
    assert.match(renglones[0], /^3 × Balde reforzado 10L — \$\s?3\.000$/);
    assert.match(renglones[1], /^1 × Remera lisa \(M · Azul\) — \$\s?4\.500$/);
  });

  it("el importe de cada renglón es cantidad por precio unitario (el precio unitario no se imprime, pero se puede comprobar)", () => {
    for (const i of receipt.items) assert.equal(i.quantity * i.unitPrice, i.subtotal, i.productName);
  });

  it("el total del texto es la suma de los importes (consistencia aritmética)", () => {
    const amount = (s) => Number(s.match(/\$\s?([\d.]+)\s*$/)[1].replaceAll(".", ""));
    const renglones = lines.filter((l) => l.includes("×")).map(amount);
    const total = amount(lines.find((l) => l.startsWith("Total:")));
    assert.equal(renglones.reduce((a, b) => a + b, 0), total);
    assert.equal(total, receipt.total);
  });

  it("aclara que NO es una factura ni un comprobante fiscal, y es lo último que se lee", () => {
    assert.equal(lines.at(-1), RECEIPT_NOTICE);
    assert.match(RECEIPT_NOTICE, /interno/i);
    assert.match(RECEIPT_NOTICE, /no es una factura ni un comprobante fiscal/i);
  });

  it("no promete nada fiscal en ningún texto del comprobante (ni CAE, ni CUIT, ni «factura» como si lo fuera)", () => {
    assert.doesNotMatch(text, /\bCAE\b|CUIT|IVA|ticket fiscal|factura (a|b|c)\b/i);
  });

  it("no incluye datos internos: stock restante, códigos de barras ni identificadores", () => {
    assert.doesNotMatch(text, /stock|quedan|barras|[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  const read = (...p) => readFileSync(join(import.meta.dirname, "..", ...p), "utf8");

  it("la pantalla muestra la leyenda, el logo y los datos del comercio dentro del comprobante que se imprime", () => {
    const view = read("src", "components", "panel", "pos", "receipt-view.tsx");
    const body = view.slice(view.indexOf('id="comprobante"'), view.indexOf("export function printReceipt"));
    assert.ok(body.includes("{RECEIPT_NOTICE}"), "la leyenda debe estar dentro de #comprobante");
    assert.ok(view.includes("receiptHeader(BUSINESS)") && body.includes("{header}"), "la identificación del negocio debe estar dentro de #comprobante");
    assert.ok(body.includes("/brand/logo-horizontal.png"), "el logo debe estar dentro de #comprobante");
    for (const col of ["Producto", "Cant.", "Precio", "Subtotal"]) assert.ok(body.includes(col), "columna " + col);
    assert.ok(body.includes("receipt.paymentLabel") && body.includes("receipt.total") && body.includes("receipt.createdAt") && body.includes("receipt.number"));
    assert.doesNotMatch(body, /stockAfter|barcode|stockUpdated/, "datos internos fuera del comprobante");
    const css = read("src", "app", "globals.css");
    assert.match(css, /@media print[\s\S]*#comprobante[\s\S]*visibility: visible/, "solo se imprime el comprobante");
    assert.match(css, /@media print[\s\S]*dialog\[open\]/, "la ventana de vista previa no tapa la impresión");
  });

  it("el cierre de venta usa el mismo comprobante y no imprime el stock restante", () => {
    const drawer = read("src", "components", "panel", "pos", "pos-cart-drawer.tsx");
    assert.ok(drawer.includes("<ReceiptView receipt={receipt} />"));
    assert.match(drawer, /print:hidden">\s*\{receipt\.stockUpdated/, "el stock restante no debe imprimirse");
  });

  it("el detalle de cada venta permite reabrir el comprobante (vista previa, impresión y PDF)", () => {
    const sales = read("src", "components", "panel", "pos", "pos-recent-sales.tsx");
    assert.ok(sales.includes("Ver comprobante") && sales.includes("saleToReceipt(") && sales.includes("<ReceiptDialog"));
    const view = read("src", "components", "panel", "pos", "receipt-view.tsx");
    assert.ok(view.includes("window.print()") && view.includes("Guardar como PDF") && view.includes("receiptDocumentTitle"));
  });

  it("una venta ya registrada se convierte en comprobante sin recalcular nada", () => {
    const sale = {
      number: 7, createdAt: "2026-11-08T15:30:00.000Z", userName: "Empleada Uno", total: 4500,
      lines: [{ productName: "Remera lisa", variantLabel: "M · Azul", quantity: 1, unitPrice: 4500, subtotal: 4500 }],
    };
    const r = saleToReceipt(sale, "QR");
    assert.equal(r.paymentLabel, "QR");
    assert.equal(r.total, 4500);
    assert.deepEqual(r.items, [{ productName: "Remera lisa", variantLabel: "M · Azul", quantity: 1, unitPrice: 4500, subtotal: 4500 }]);
    assert.equal(receiptText(r).split(String.fromCharCode(10)).at(-1), RECEIPT_NOTICE);
  });

  it("el nombre de archivo sugerido al guardar como PDF lleva el número con ceros", () => {
    assert.equal(receiptDocumentTitle({ number: 42 }), "Comprobante interno 000042");
    assert.equal(receiptDocumentTitle({ number: "7" }), "Comprobante interno 000007");
  });
});
