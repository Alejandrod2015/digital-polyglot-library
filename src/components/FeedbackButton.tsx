'use client';

import * as Sentry from "@sentry/nextjs";
import { MessageSquare } from "lucide-react";

type FeedbackIntegration = { openDialog: () => void };
const isFeedbackIntegration = (x: unknown): x is FeedbackIntegration =>
  !!x && typeof (x as { openDialog?: unknown }).openDialog === "function";

interface SentryWithDialog {
  showReportDialog?: (options?: Record<string, unknown>) => void;
}

export default function FeedbackButton() {
  const handleClick = (): void => {
    const client = Sentry.getClient();
    const integration = (client as unknown as {
      getIntegrationByName?: (name: string) => unknown;
    })?.getIntegrationByName?.("Feedback");

    if (isFeedbackIntegration(integration)) {
      integration.openDialog();
      return;
    }

    const eventId =
      Sentry.lastEventId() ||
      Sentry.captureException(new Error("User feedback (no prior event)"));

    const sentryRuntime = Sentry as unknown as SentryWithDialog;
    if (typeof sentryRuntime.showReportDialog === "function") {
      sentryRuntime.showReportDialog({ eventId });
      return;
    }

    alert("Feedback module not ready. Please reload and try again.");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Send feedback"
      className="hidden md:flex fixed bottom-4 right-4 z-50 items-center justify-center w-12 h-12 rounded-full bg-[#1f1f1f] text-gray-300 shadow-md hover:bg-[#2a2a2a] hover:text-white transition"
    >
      <MessageSquare size={22} strokeWidth={2} />
    </button>
  );
}
