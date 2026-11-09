import { fiscalDeps } from "@/lib/fiscal/runtime";
import { handleRequest } from "@/lib/fiscal/handlers";

/** Solo desarrolladores autorizados (ver src/lib/fiscal/handlers.ts). No emite nada: ARCA no está integrada. */
export async function POST(request: Request) {
  return handleRequest(request, fiscalDeps());
}
