// Client-side Sentry init. Captures unhandled errors and promise rejections
// in the browser, plus performance traces. Tracing is sampled low (10%) and
// session replay is off by default so we don't blow through the free tier.
//
// Solo arranca en un build de produccion. `next dev` tiene NODE_ENV
// "development" y sin esta guarda mandaba al proyecto de PRODUCCION los
// errores del servidor de desarrollo (webpack, _document.js, JSON a medio
// escribir) y sus trazas, que subian el p95 de las paginas a decenas de
// segundos. La guarda no depende de NEXT_PUBLIC_VERCEL_ENV, que no esta
// garantizada en el bundle del cliente.
import * as Sentry from "@sentry/nextjs";
import { IGNORED_ERRORS } from "./sentry.ignored";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: IGNORED_ERRORS,
  });
}
