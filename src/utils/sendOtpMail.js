import * as Brevo from "@getbrevo/brevo";

/**
 * Send a transactional email via Brevo SDK.
 *
 * Signature: sendOtpMail(toEmail, subject, html)
 *   toEmail  — recipient email address (string)
 *   subject  — email subject line (string)
 *   html     — full HTML body (string)
 *
 * Returns: Promise<{ success: true, messageId: string }>
 * Throws:  Error with descriptive message — callers MUST catch.
 *
 * Required env vars:
 *   BREVO_API_KEY      — Brevo API key (Brevo dashboard → Settings → API Keys)
 *   BREVO_SENDER_EMAIL — verified sender address in Brevo
 *   BREVO_SENDER_NAME  — (optional) display name, defaults to "Nestro"
 */

// Warn at import time so misconfiguration is visible immediately on startup
if (!process.env.BREVO_API_KEY) {
  console.error("[sendOtpMail] ⚠️  BREVO_API_KEY is not set in .env");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.error("[sendOtpMail] ⚠️  BREVO_SENDER_EMAIL is not set in .env");
}

const sendOtpMail = async (toEmail, subject, html) => {
  // ── Runtime guards ───────────────────────────────────────────────────────
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured in .env");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is not configured in .env");
  }

  // ── Initialise Brevo TransactionalEmailsApi ──────────────────────────────
  const apiInstance = new Brevo.TransactionalEmailsApi();
  apiInstance.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

  // ── Build the email payload ──────────────────────────────────────────────
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = {
    name: process.env.BREVO_SENDER_NAME || "Nestro",
    email: process.env.BREVO_SENDER_EMAIL,
  };
  sendSmtpEmail.to = [{ email: toEmail }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;

  // ── Send ─────────────────────────────────────────────────────────────────
  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = result?.body?.messageId ?? result?.messageId ?? "unknown";
    console.log(`[sendOtpMail] ✅ Email sent to ${toEmail} | messageId: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    // Brevo SDK wraps HTTP errors — extract the human-readable message
    const detail =
      err?.response?.body?.message ||
      err?.response?.text ||
      err?.message ||
      "Unknown Brevo error";
    console.error(`[sendOtpMail] ❌ Failed to send to ${toEmail}:`, detail);
    throw new Error(`Brevo email failed: ${detail}`);
  }
};

export default sendOtpMail;
