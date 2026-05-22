// HARD seal: server-only. Si cualquier client component intenta
// importar este módulo (directo o transitivamente), Next.js falla en
// compile time con un error claro en vez de bundlear prisma al
// browser (que peta con "PrismaClient is unable to run in this
// browser environment"). Es la red de seguridad que evita futuros
// leaks del estilo JourneyClient → journeyData → prisma.
import "server-only";
import { PrismaClient } from "@/generated/prisma";

/**
 * Errores transitorios típicos cuando Neon + pgbouncer cierra una
 * conexión idle mid-query (serverless cold/warm cycle). El engine
 * reporta una "response empty" o termina la conexión. Reintentar la
 * misma query suele resolverlo porque Prisma abre nueva conexión.
 */
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /Response from the Engine was empty/i,
  /Engine is not yet connected/i,
  /Engine is not yet started/i,
  /Closed Connection/i,
  /Connection terminated/i,
  /Connection refused/i,
  /Connection reset by peer/i,
  /ECONNRESET/i,
  /server has gone away/i,
];

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  return TRANSIENT_ERROR_PATTERNS.some((re) => re.test(message));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Shared connect promise: cada query AWAITa este promise antes de
  // ejecutar. Garantiza que el binary-engine de Prisma terminó de
  // conectar antes del primer query (elimina la race "Engine is not
  // yet connected" que pasa en cold start o HMR). $connect() es
  // idempotente; el promise se resuelve una sola vez y queda en
  // memoria, así que solo el primer query paga el costo.
  const connectPromise: Promise<void> = base
    .$connect()
    .catch((err) => {
      console.error("[prisma] $connect failed:", err);
      // No re-throw: dejamos que el retry wrapper de abajo intente
      // de nuevo cuando el query corra. Si el engine no levanta
      // nunca, todos los queries fallarán pero con el error real
      // de DB en vez de "engine not connected".
    });

  // Retry transitorio en TODAS las operaciones. Backoff exponencial
  // 200ms → 400ms → 800ms → 1600ms. Solo reintenta si el error
  // matchea el patrón conocido (pool cut idle, connection drop,
  // engine not yet connected) — otros errores (constraint,
  // validation) pasan directo.
  return base.$extends({
    query: {
      async $allOperations({ args, query, operation, model }) {
        // Asegurar que el connect inicial terminó antes del primer
        // query. Para queries posteriores el await es ~0ms porque
        // el promise ya está resuelto.
        await connectPromise;

        const MAX_ATTEMPTS = 4;
        let lastError: unknown;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastError = err;
            if (!isTransientError(err) || attempt === MAX_ATTEMPTS - 1) {
              throw err;
            }
            const delay = 200 * Math.pow(2, attempt);
            if (process.env.NODE_ENV === "development") {
              console.warn(
                `[prisma-retry] ${model ?? "?"}.${operation} transient error; retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${delay}ms`,
                err instanceof Error ? err.message : err,
              );
            }
            // En el caso específico de "Engine is not yet connected"
            // forzamos un reconnect explícito antes del retry para
            // empujar al engine a inicializarse.
            if (
              err instanceof Error &&
              /Engine is not yet connected/i.test(err.message)
            ) {
              try {
                await base.$connect();
              } catch {
                // Silenciamos; el retry siguiente captura el error.
              }
            }
            await sleep(delay);
          }
        }
        // Unreachable salvo bug: el loop arriba siempre lanza o
        // retorna; este throw es defensivo para TS.
        throw lastError;
      },
    },
  });
}

type PrismaClientWithRetry = ReturnType<typeof createPrismaClient>;

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClientWithRetry;
};

const globalForPrisma = globalThis as GlobalPrisma;

export const prisma: PrismaClientWithRetry =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
