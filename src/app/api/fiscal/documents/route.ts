import { fiscalDeps } from "@/lib/fiscal/runtime";
import { handleList } from "@/lib/fiscal/handlers";

/** Solo desarrolladores autorizados (ver src/lib/fiscal/handlers.ts). No emite nada: ARCA no está integrada. */
export async function GET(request: Request) {
  return handleList(request, fiscalDeps());
}
