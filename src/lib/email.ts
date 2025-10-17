// /src/lib/email.ts
import { Resend } from "resend";
import { getBookTitle } from "@/lib/books";

/**
 * Envía un correo de redención de libros usando Resend.
 * Los datos (títulos) se obtienen directamente desde Sanity.
 */
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
  const replyTo = "support@digitalpolyglot.com";

  if (!apiKey || !from) {
    console.warn("⚠️ RESEND_API_KEY o EMAIL_FROM no definida, se omite envío de correo");
    return "skipped";
  }

  // 🔹 Obtiene los títulos reales desde Sanity
  const titles = await Promise.all(books.map((slug) => getBookTitle(slug)));

  const claimUrl = `${baseUrl}/claim/${token}`;
  const subject = "Your Digital Polyglot books are ready!";
  const preheader = "Access your books instantly and start reading.";

  const text = [
    "Your Digital Polyglot purchase is ready.",
    `Access your books: ${claimUrl}`,
    "",
    "Purchased books:",
    ...titles.map((t) => `• ${t}`),
    "",
    "If you didn’t make this purchase, please ignore this email or contact support.",
  ].join("\n");

  const html = `
  <div style="background:#f6f8fb;padding:24px 0;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      ${preheader}
    </span>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560"
                 style="width:560px;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            
            <tr>
              <td style="background:#0D1B2A;padding:20px 24px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#E5E7EB;font-size:14px;">
                  <strong style="color:#fff;font-size:16px;">Digital Polyglot</strong><br/>
                  Your digital library for Spanish learners
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.6;">
                  
                  <h1 style="margin:0 0 12px;font-size:22px;">📚 Your books are ready!</h1>
                  <p style="margin:0 0 20px;color:#374151;">
                    If this was a gift, you can forward this email to the recipient so they can access their books.
                  </p>

                  <p style="margin:12px 0 28px;text-align:center;">
                    <a href="${claimUrl}"
                       style="background:#0ea5e9;color:#ffffff;padding:14px 24px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;">
                      Access your books
                    </a>
                  </p>

                  <p style="margin:0 0 12px;font-weight:600;">Purchased books:</p>
                  <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
                    ${titles.map((t) => `<li>${t}</li>`).join("")}
                  </ul>

                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">

                  <p style="font-size:12px;color:#6B7280;margin:0;text-align:center;">
                    This is a transactional email for your Digital Polyglot purchase.<br/>
                    If you need help, reply to this message or visit
                    <a href="https://reader.digitalpolyglot.com/support" style="color:#0ea5e9;">our support page</a>.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#F3F4F6;padding:16px 24px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#6B7280;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} Digital Polyglot • reader.digitalpolyglot.com
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
      tags: [{ name: "type", value: "transactional" }],
    });
    console.log(`📨 Email de redención enviado a ${to}`);
    return "sent";
  } catch (err) {
    console.error("❌ Error enviando email con Resend:", err);
    return "failed";
  }
}
