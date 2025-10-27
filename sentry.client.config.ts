import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [],
});

// Expose Sentry globally for the Feedback dialog
if (typeof window !== "undefined") {
  (window as unknown as { Sentry: typeof Sentry }).Sentry = Sentry;
}
