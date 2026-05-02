'use client';

import { MessageSquare } from "lucide-react";

const FEEDBACK_MAILTO = `mailto:alejandro@muvn.de?subject=${encodeURIComponent(
  "Feedback — Digital Polyglot Library"
)}&body=${encodeURIComponent("Tell us what's on your mind:\n\n")}`;

export default function FeedbackButton() {
  return (
    <a
      href={FEEDBACK_MAILTO}
      aria-label="Send feedback"
      className="hidden md:flex fixed bottom-4 right-4 z-50 items-center justify-center w-12 h-12 rounded-full bg-[#1f1f1f] text-gray-300 shadow-md hover:bg-[#2a2a2a] hover:text-white transition"
    >
      <MessageSquare size={22} strokeWidth={2} />
    </a>
  );
}
