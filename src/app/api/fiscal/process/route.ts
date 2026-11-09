import { fiscalDeps } from "@/lib/fiscal/runtime";
import { handleProcess } from "@/lib/fiscal/handlers";

/** Solo desarrolladores autorizados (ver src/lib/fiscal/handlers.ts). No emite nada: ARCA no está integrada. */
export async function POST(request: Request) {
  return handleProcess(request, fiscalDeps());
}
