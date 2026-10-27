/**
 * Utilidades de códigos EAN/UPC sin dependencias (funcionan en servidor, navegador y Node).
 * - Dígito verificador: descarta lecturas erróneas de la cámara.
 * - Codificación EAN-13: dibuja códigos de ejemplo que se pueden escanear desde otra pantalla.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
// Paridad de los 6 dígitos de la izquierda según el primer dígito.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Dígito verificador (módulo 10) de un cuerpo sin él: 7, 11, 12 o 13 dígitos. */
export function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Completa un cuerpo de 12 dígitos con su verificador y devuelve el EAN-13. */
export function ean13(body12: string): string {
  if (!/^\d{12}$/.test(body12)) throw new Error("El cuerpo del EAN-13 debe tener 12 dígitos");
  return body12 + checkDigit(body12);
}

/** true si es un EAN-8, UPC-A, EAN-13 o GTIN-14 con dígito verificador correcto. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** 95 módulos ("1" = barra, "0" = espacio) de un EAN-13 válido. */
export function ean13Modules(code: string): string {
  if (!/^\d{13}$/.test(code) || !hasValidCheckDigit(code)) throw new Error("EAN-13 inválido");
  const parity = PARITY[Number(code[0])];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = Number(code[i + 1]);
    bits += parity[i] === "L" ? L[d] : G[d];
  }
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += R[Number(code[i])];
  return bits + "101";
}
