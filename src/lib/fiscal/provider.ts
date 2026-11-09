/**
 * Proveedor de emisión fiscal (ARCA). SOLO la interfaz y un adaptador sin conexión: en esta etapa NO existe ninguna
 * llamada de emisión a ARCA. El adaptador real (WSAA para el ticket de acceso y WSFEv1 para autorizar el comprobante) se
 * escribe cuando haya credenciales y datos fiscales confirmados; hasta entonces, pedir una emisión termina en un error
 * registrado («no implementado») y nunca produce un comprobante.
 */
export type IssueRequest = {
  documentId: string;
  saleId: string;
  environment: "homologacion" | "produccion";
};

export type ProviderResult =
  | { kind: "issued"; docType: number; pointOfSale: number; number: number; cae: string; caeExpiresOn: string; raw?: Record<string, unknown> }
  | { kind: "rejected"; reason: string; raw?: Record<string, unknown> };

export interface FiscalProvider {
  readonly name: string;
  issue(request: IssueRequest): Promise<ProviderResult>;
}

export class FiscalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FiscalError";
    this.code = code;
  }
}

/**
 * Adaptador de ARCA todavía SIN integrar: no abre ninguna conexión ni usa credenciales. Existe para que el flujo
 * (estados, eventos, idempotencia) quede armado y probado; reemplazarlo es lo único que falta para emitir.
 */
export function createArcaProvider(): FiscalProvider {
  return {
    name: "arca-no-integrado",
    async issue() {
      throw new FiscalError("not_implemented", "La integración con ARCA todavía no está implementada: no se envió nada.");
    },
  };
}
