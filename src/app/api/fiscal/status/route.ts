import { fiscalDeps } from "@/lib/fiscal/runtime";
import { handleStatus } from "@/lib/fiscal/handlers";

/** Solo desarrolladores autorizados (ver src/lib/fiscal/handlers.ts). No emite nada: ARCA no está integrada. */
export async function GET(request: Request) {
  return handleStatus(request, fiscalDeps());
}
