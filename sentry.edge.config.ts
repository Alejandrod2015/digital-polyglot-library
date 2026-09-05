// Edge runtime Sentry init. Captures errors in middleware and any route
// handler that runs at the edge.
//
// Solo en produccion: ver la nota de sentry.client.config.ts.
import * as Sentry from "@sentry/nextjs";
import { IGNORED_ERRORS } from "./sentry.ignored";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: IGNORED_ERRORS,
  });
}
