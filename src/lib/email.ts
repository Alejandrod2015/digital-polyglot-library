// /src/lib/email.ts
import { Resend } from "resend";
import { getBookTitle } from "@/lib/books";
import {
  LIFECYCLE_BUILDERS,
  type LifecycleKind,
  type LifecycleData,
} from "@/lib/emails/lifecycle";
import { shouldSendLifecycle, createEmailToken } from "@/lib/emailPreferences";

/**
 * Confirmation sent after someone applies to the beta program at /beta.
 * Transactional only (no marketing). Replies route to support.
 */
export async function sendBetaConfirmationEmail({
  to,
  targetLanguage,
}: {
  to: string;
  targetLanguage: string;
}): Promise<"sent" | "skipped" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = "support@digitalpolyglot.com";

  if (!apiKey || !from) {
    console.warn("⚠️ RESEND_API_KEY or EMAIL_FROM not defined, skipping beta confirmation email");
    return "skipped";
  }

  const subject = "We received your beta application 🎉";
  const preheader = "You're on the list. We'll be in touch soon.";

  const text = [
    "Thanks for applying to the Digital Polyglot beta.",
    "",
    `We received your application (target language: ${targetLanguage}).`,
    "Most applicants hear back within 1-2 weeks once a TestFlight spot opens.",
    "",
    "Once you're in, you can send feedback two ways:",
    "  1) The Support button in the app's Settings screen.",
    "  2) TestFlight's built-in feedback (shake your phone or use the screenshot button).",
    "",
    "If you have questions before then, reply to this email or write to support@digitalpolyglot.com.",
    "",
    "- Digital Polyglot",
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

                  <h1 style="margin:0 0 12px;font-size:22px;">🎉 You're on the list</h1>
                  <p style="margin:0 0 16px;color:#374151;">
                    Thanks for applying to the Digital Polyglot beta. We received your application for <strong>${targetLanguage}</strong>.
                  </p>
                  <p style="margin:0 0 16px;color:#374151;">
                    Most applicants hear back within 1-2 weeks once a TestFlight spot opens. You don't need to do anything in the meantime.
                  </p>

                  <h2 style="margin:24px 0 8px;font-size:15px;color:#111827;">Once you're in</h2>
                  <p style="margin:0 0 12px;color:#374151;font-size:14px;">
                    Your feedback matters more than anything during the beta. You can send it two ways:
                  </p>
                  <ul style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
                    <li>The <strong>Support</strong> button inside the app's Settings screen.</li>
                    <li>TestFlight's built-in feedback (screenshot + comment).</li>
                  </ul>

                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">

                  <p style="font-size:12px;color:#6B7280;margin:0;text-align:center;">
                    Questions? Reply to this email or write to
                    <a href="mailto:support@digitalpolyglot.com" style="color:#0ea5e9;">support@digitalpolyglot.com</a>.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#F3F4F6;padding:16px 24px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#6B7280;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} Digital Polyglot • digitalpolyglot.com
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
      tags: [{ name: "type", value: "transactional" }, { name: "category", value: "beta-confirmation" }],
    });

    console.log(`📧 Beta confirmation email sent to ${to}`);
    return "sent";
  } catch (err) {
    console.error("❌ Error sending beta confirmation email:", err);
    return "failed";
  }
}

/**
 * Welcome email sent the instant a new user signs up (Clerk user.created).
 * Lifecycle/onboarding email, single opt-in. One single CTA: drive the user
 * to finish their first story, which is DPL's activation (aha) moment.
 * Uses the lifecycle design system (src/lib/emails/*).
 */
export async function sendWelcomeEmail({
  to,
  data,
}: {
  to: string;
  data?: LifecycleData;
}): Promise<"sent" | "skipped" | "failed"> {
  return sendLifecycleEmail({ kind: "welcome", to, data });
}

/**
 * Generic sender for any of the 9 lifecycle emails. The triggers (webhook,
 * lifecycle cron) call this with the right `kind` and dynamic `data`.
 * Single opt-in, transactional+lifecycle tag. A Resend failure returns
 * "failed" and never throws (callers wrap signup-critical paths anyway).
 */
export async function sendLifecycleEmail({
  kind,
  to,
  data,
}: {
  kind: LifecycleKind;
  to: string;
  data?: LifecycleData;
}): Promise<"sent" | "skipped" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = "support@digitalpolyglot.com";

  if (!apiKey || !from) {
    console.warn(`⚠️ RESEND_API_KEY or EMAIL_FROM not defined, skipping ${kind} email`);
    return "skipped";
  }

  // Respect granular opt-outs (fail-open: a DB error never blocks a send).
  if (!(await shouldSendLifecycle(kind, to))) {
    console.log(`🔕 Lifecycle email (${kind}) skipped: ${to} opted out`);
    return "skipped";
  }

  // Signed token so unsubscribe / manage links work without a logged-in session.
  const token = createEmailToken(to);
  const appBase = process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";
  const unsubscribeUrl = `${appBase}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;

  const { subject, html, text } = LIFECYCLE_BUILDERS[kind]({ ...data, unsubscribeToken: token });

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
      // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo for bulk senders).
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "type", value: "lifecycle" }, { name: "category", value: kind }],
    });
    console.log(`📧 Lifecycle email (${kind}) sent to ${to}`);
    return "sent";
  } catch (err) {
    console.error(`❌ Error sending ${kind} email:`, err);
    return "failed";
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

  const titles = await Promise.all(books.map((slug) => getBookTitle(slug)));
  const claimUrl = `${baseUrl}/claim/${token}`;

  const subject = "Your Digital Polyglot books are ready 📚";
  const preheader = "Access your books and start reading instantly.";

  const text = [
    "Your Digital Polyglot books are ready to read and listen.",
    `Open them here: ${claimUrl}`,
    "You will sign in or create a free account, and your books appear in My Library.",
    "",
    "Included books (each with narrated audio):",
    ...titles.map((t) => `• ${t}`),
    "",
    "Come back anytime at digitalpolyglot.com and open My Library.",
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
                  
                  <h1 style="margin:0 0 12px;font-size:22px;">📚 Your books are ready to read and listen</h1>
                  <p style="margin:0 0 8px;color:#374151;">
                    Tap the button below to open your library. You will sign in or create a free account, and every book (with its narrated audio) appears in <strong>My Library</strong>, on any device.
                  </p>
                  <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">
                    If this was a gift, forward this email to the recipient so they can open the books.
                  </p>

                  <p style="margin:12px 0 28px;text-align:center;">
                    <a href="${claimUrl}"
                       style="background:#0ea5e9;color:#ffffff;padding:14px 24px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;">
                      Open my library
                    </a>
                  </p>

                  <p style="margin:0 0 12px;font-weight:600;">Included books (each with narrated audio):</p>
                  <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
                    ${titles.map((t) => `<li>${t}</li>`).join("")}
                  </ul>

                  <p style="margin:0 0 20px;color:#374151;font-size:14px;">
                    Come back anytime at <a href="https://digitalpolyglot.com" style="color:#0ea5e9;">digitalpolyglot.com</a> and open <strong>My Library</strong>. Your books stay in your account.
                  </p>

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
                  © ${new Date().getFullYear()} Digital Polyglot • digitalpolyglot.com
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
