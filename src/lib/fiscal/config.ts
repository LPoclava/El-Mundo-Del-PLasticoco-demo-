/**
 * Configuración fiscal del SERVIDOR (ARCA). Nada de este módulo debe importarse desde un componente de pantalla ni leerse
 * en el navegador: las credenciales viven solo en variables de entorno del servidor (sin el prefijo NEXT_PUBLIC_), nunca
 * en el repositorio, en la base ni en una respuesta HTTP. Lo que SÍ puede salir hacia afuera es únicamente el estado
 * («configurado» o la lista de NOMBRES de variables que faltan), jamás un valor.
 *
 * Variables:
 *   FISCAL_ARCA_CUIT            CUIT del emisor (solo dígitos).
 *   FISCAL_ARCA_POINT_OF_SALE   Punto de venta habilitado para facturación electrónica.
 *   FISCAL_ARCA_CERT            Certificado digital (PEM).
 *   FISCAL_ARCA_KEY             Clave privada del certificado (PEM).
 *   FISCAL_ARCA_ENV             «homologacion» (por defecto) o «produccion».
 *   FISCAL_PRODUCTION_ALLOWED   «1» habilita producción de ESTE lado. Por defecto, apagado. Además hace falta que la base
 *                               tenga fiscal_settings.production_enabled = true (dos llaves independientes).
 */
export const REQUIRED_ENV = ["FISCAL_ARCA_CUIT", "FISCAL_ARCA_POINT_OF_SALE", "FISCAL_ARCA_CERT", "FISCAL_ARCA_KEY"] as const;

export type FiscalEnvironment = "homologacion" | "produccion";

export type FiscalConfig = {
  /** Nombres de las variables obligatorias que faltan o están vacías (nunca sus valores). */
  missing: string[];
  configured: boolean;
  environment: FiscalEnvironment;
  /** Llave del servidor para producción (la de la base es independiente). Apagada por defecto. */
  productionAllowed: boolean;
};

type Env = Record<string, string | undefined>;

/** Lee el estado de la configuración. No devuelve ningún valor secreto. */
export function readFiscalConfig(env: Env = process.env): FiscalConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  const environment: FiscalEnvironment = env.FISCAL_ARCA_ENV?.trim() === "produccion" ? "produccion" : "homologacion";
  return {
    missing: [...missing],
    configured: missing.length === 0,
    environment,
    productionAllowed: env.FISCAL_PRODUCTION_ALLOWED?.trim() === "1",
  };
}

/** Credenciales para el proveedor (solo para código del servidor que las necesite; no se serializan ni se registran). */
export function readFiscalSecrets(env: Env = process.env): { cuit: string; pointOfSale: string; cert: string; key: string } | null {
  const cfg = readFiscalConfig(env);
  if (!cfg.configured) return null;
  return {
    cuit: env.FISCAL_ARCA_CUIT!.trim(),
    pointOfSale: env.FISCAL_ARCA_POINT_OF_SALE!.trim(),
    cert: env.FISCAL_ARCA_CERT!,
    key: env.FISCAL_ARCA_KEY!,
  };
}
