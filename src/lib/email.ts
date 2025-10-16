// src/lib/email.ts
import { Resend } from "resend";

export async function sendClaimEmail({
  to,
  token,
  books,
}: {
  to: string;
  token: string;
  books: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY no definida, se omite envío de correo");
    return;
  }

  const resend = new Resend(apiKey);
  const claimUrl = `${process.env.APP_BASE_URL}/claim/${token}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; color: #222;">
      <h2>🎉 Your Digital Polyglot books are ready!</h2>
      <p>You can access them here:</p>
      <p><a href="${claimUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Access your books</a></p>
      <ul>${books.map((b) => `<li>${b}</li>`).join("")}</ul>
    </div>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Your Digital Polyglot books are ready!",
    html,
  });
}
