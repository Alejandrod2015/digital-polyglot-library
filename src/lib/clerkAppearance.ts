export const clerkAppearance = {
  variables: {
    colorPrimary: "#2563eb",
    colorBackground: "#0b1e36",
    colorInputBackground: "#102746",
    colorInputText: "#e6edf7",
    colorText: "#e6edf7",
    colorTextSecondary: "#9fb1c8",
    colorDanger: "#ef4444",
    borderRadius: "0.875rem",
  },
  layout: {
    shimmer: true,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    card: "bg-[#0b1e36]/95 border border-white/10 shadow-2xl backdrop-blur-xl",
    headerTitle: "text-white text-2xl font-semibold",
    headerSubtitle: "text-[#9fb1c8]",
    socialButtonsBlockButton:
      "bg-[#133153] border border-white/10 !text-white hover:bg-[#183c66] transition [&_span]:!text-white [&_p]:!text-white [&_div]:!text-white",
    socialButtonsBlockButtonText: "!text-white",
    formButtonPrimary:
      "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md transition",
    formFieldLabel: "text-[#c6d3e5]",
    formFieldInput:
      "bg-[#102746] border border-white/15 text-white placeholder:text-[#7f97b5] focus:border-[#3b82f6] focus:ring-[#3b82f6]/25",
    footerActionText: "text-[#9fb1c8]",
    footerActionLink: "text-[#60a5fa] hover:text-[#93c5fd]",
    identityPreviewText: "text-[#9fb1c8]",
    otpCodeFieldInput: "bg-[#102746] border border-white/15 text-white",
  },
};
