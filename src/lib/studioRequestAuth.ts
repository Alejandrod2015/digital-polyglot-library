import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { STUDIO_SECRET_HEADER, hasStudioSharedSecret } from "@/lib/studioSharedSecret";

// Gate de las rutas de generacion que pagan OpenAI/ElevenLabs
// (/api/generate-title, generate-synopsis, generate-vocab, validate-vocab).
//
// POR QUE (auditoria 2026-09-18): esas cuatro rutas salian a produccion sin
// ninguna comprobacion y con `Access-Control-Allow-Origin: *`; cualquiera podia
// gastar creditos con un POST anonimo. No llevaban gate porque sus unicos
// consumidores son wrappers de /api/studio/** que las llaman servidor a
// servidor SIN reenviar la sesion de Clerk, asi que un gate de sesion a secas
// los habria roto. La solucion es el mismo secreto compartido que ya usan
// status/publish: el wrapper (que si exige sesion de Studio) firma el salto
// interno con `x-dpl-cron-secret`, y la ruta acepta ese secreto o una sesion
// de Studio directa. Sin CRON_SECRET en el entorno el salto interno falla
// cerrado (401), nunca abierto.

/** true si la peticion trae el secreto compartido o una sesion de Studio. */
export async function isStudioRequest(request: Request): Promise<boolean> {
  if (hasStudioSharedSecret(request)) return true;

  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return Boolean(email && (await isStudioMember(email)));
}

/** Cabeceras para el salto interno wrapper -> ruta de generacion. */
export function studioInternalHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET?.trim();
  return {
    "Content-Type": "application/json",
    ...(secret ? { [STUDIO_SECRET_HEADER]: secret } : {}),
  };
}
