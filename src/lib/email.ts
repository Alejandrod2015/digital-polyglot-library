// /src/lib/email.ts
import { Resend } from "resend";
import { client as sanityClient } from "@/sanity/lib/client";

/**
 * Gets the book title from Sanity by its slug.
 */
async function getBookTitle(slug: string): Promise<string> {
  try {
    const query = `*[_type == "book" && slug.current == $slug][0]{ title }`;
    const result = await sanityClient.fetch<{ title?: string } | null>(query, { slug });
    return result?.title ?? slug;
  } catch (err) {
    console.error("⚠️ Error fetching title from Sanity for:", slug, err);
    return slug;
  }
}

/**
 * Sends the email with the access link to the books.
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
    console.warn("⚠️ RESEND_API_KEY or EMAIL_FROM not defined, skipping email send");
    return "skipped";
  }

  // 🔹 Get titles from Sanity
  const titles = await Promise.all(books.map((slug) => getBookTitle(slug)));
  const claimUrl = `${baseUrl}/claim/${token}`;

  const subject = "Your Digital Polyglot books are ready 📚";
  const preheader = "Access your books and start reading instantly.";

  const text = [
    "Your Digital Polyglot books are ready.",
    `Access them with this link: ${claimUrl}`,
    "",
    "Included books:",
    ...titles.map((t) => `• ${t}`),
    "",
    "If you didn’t make this purchase, ignore this message or contact us at support@digitalpolyglot.com.",
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
                  Your digital library for language learning
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.6;">
                  
                  <h1 style="margin:0 0 12px;font-size:22px;">📚 Your books are ready</h1>
                  <p style="margin:0 0 20px;color:#374151;">
                    If this was a gift, you can forward this email to the intended recipient so they can access the books.
                  </p>

                  <p style="margin:12px 0 28px;text-align:center;">
                    <a href="${claimUrl}"
                       style="background:#0ea5e9;color:#ffffff;padding:14px 24px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;">
                      Open my books
                    </a>
                  </p>

                  <p style="margin:0 0 12px;font-weight:600;">Included books:</p>
                  <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
                    ${titles.map((t) => `<li>${t}</li>`).join("")}
                  </ul>

                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">

                  <p style="font-size:12px;color:#6B7280;margin:0;text-align:center;">
                    This is a transactional email from Digital Polyglot.<br/>
                    If you need help, write to
                    <a href="mailto:support@digitalpolyglot.com" style="color:#0ea5e9;">support@digitalpolyglot.com</a>.
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

    console.log(`📧 Claim email sent to ${to}`);
    return "sent";
  } catch (err) {
    console.error("❌ Error sending email with Resend:", err);
    return "failed";
  }
}
