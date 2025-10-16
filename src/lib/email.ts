// DESPUÉS
import { Resend } from "resend";

export async function sendClaimEmail({
  to,
  token,
  books,
}: {
  to: string;
  token: string;
  books: string[];
}): Promise<"sent" | "skipped" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const baseUrl = process.env.APP_BASE_URL ?? "https://reader.digitalpolyglot.com";

  if (!apiKey || !from) {
    console.warn("⚠️ RESEND_API_KEY o EMAIL_FROM no definida, se omite envío de correo");
    return "skipped";
  }

  const resend = new Resend(apiKey);
  const claimUrl = `${baseUrl}/claim/${token}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; color: #222;">
      <h2>🎉 Your Digital Polyglot books are ready!</h2>
      <p>You can access them here:</p>
      <p><a href="${claimUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Access your books</a></p>
      <ul>${books.map((b) => `<li>${b}</li>`).join("")}</ul>
    </div>
  `;

  try {
    await resend.emails.send({ from, to, subject: "Your Digital Polyglot books are ready!", html });
    return "sent";
  } catch (err) {
    console.error("❌ Error enviando email con Resend:", err);
    return "failed";
  }
}
