/**
 * sendOtpMail — sends transactional email via Brevo REST API (no SDK).
 *
 * Supports two call signatures:
 *   sendOtpMail(toEmail, otp)               — registration / resend OTP
 *   sendOtpMail(toEmail, subject, htmlBody)  — custom subject + body
 *
 * Required env vars:
 *   BREVO_API_KEY      — Brevo API key (Settings → API Keys)
 *   BREVO_SENDER_EMAIL — verified sender address in Brevo
 *   BREVO_SENDER_NAME  — (optional) display name, defaults to "Nestro"
 */

// Warn at import time if config is missing
if (!process.env.BREVO_API_KEY) {
  console.error("[sendOtpMail] ⚠️  BREVO_API_KEY is not set in .env");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.error("[sendOtpMail] ⚠️  BREVO_SENDER_EMAIL is not set in .env");
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

// ── Default OTP HTML template ─────────────────────────────────────────────────
function buildDefaultHtml(otp) {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#faf8f5;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(58,36,24,0.08);">
        <div style="background:#2b180f;padding:28px 32px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;letter-spacing:6px;margin:0;font-weight:700;">NESTRO.</h1>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#1a1007;font-size:20px;margin:0 0 8px;">Verify Your Email</h2>
          <p style="color:#9a8a7a;font-size:14px;margin:0 0 28px;line-height:1.6;">
            Use the OTP below to complete your verification.
            It expires in <strong>3 minutes</strong>.
          </p>
          <div style="background:#faf0e8;border:2px dashed #d9b48b;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
            <p style="color:#9a8a7a;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">Your OTP Code</p>
            <h1 style="color:#3a2418;font-size:42px;letter-spacing:10px;margin:0;font-weight:800;font-family:monospace;">${otp}</h1>
          </div>
          <p style="color:#9a8a7a;font-size:13px;line-height:1.6;margin:0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        <div style="border-top:1px solid #f0ebe4;padding:20px 32px;text-align:center;">
          <p style="color:#c9b9a8;font-size:12px;margin:0;">&#169; 2026 Nestro &middot; Curated Furniture</p>
        </div>
      </div>
    </div>
  `;
}

// ── Main function ─────────────────────────────────────────────────────────────
const sendOtpMail = async (toEmail, subjectOrOtp, htmlBody) => {
  // ── Validate env vars ────────────────────────────────────────────────────
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured in .env");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is not configured in .env");
  }

  // ── Validate recipient ───────────────────────────────────────────────────
  if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
    throw new Error(`sendOtpMail: invalid recipient email — "${toEmail}"`);
  }

  // ── Resolve subject + html from call signature ───────────────────────────
  // 2-arg call: sendOtpMail(email, otp)         → use default template
  // 3-arg call: sendOtpMail(email, subject, html)→ use provided subject + html
  const isCustom = typeof htmlBody === "string" && htmlBody.trim().length > 0;
  const subject = isCustom ? subjectOrOtp : "Your Nestro Verification Code";
  const html = isCustom ? htmlBody : buildDefaultHtml(subjectOrOtp);

  // ── Build request payload ────────────────────────────────────────────────
  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || "Nestro",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
  };

  // ── 30-second timeout via AbortController ────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timer);
    if (fetchErr.name === "AbortError") {
      throw new Error("Brevo email failed: request timed out after 30 seconds");
    }
    throw new Error(`Brevo email failed: network error — ${fetchErr.message}`);
  }
  clearTimeout(timer);

  // ── Parse response safely ────────────────────────────────────────────────
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Response was not JSON — use raw text for error reporting
  }

  // ── Handle non-2xx ───────────────────────────────────────────────────────
  if (!response.ok) {
    const brevoMessage =
      parsed?.message ||
      parsed?.error ||
      raw ||
      `HTTP ${response.status}`;
    console.error(
      `[sendOtpMail] ❌ Brevo API error ${response.status} sending to ${toEmail}:`,
      brevoMessage
    );
    throw new Error(`Brevo email failed: ${brevoMessage}`);
  }

  // ── Success ──────────────────────────────────────────────────────────────
  const messageId = parsed?.messageId ?? "unknown";
  console.log(`[sendOtpMail] ✅ Email sent to ${toEmail} | messageId: ${messageId}`);
  return { success: true, messageId };
};

export default sendOtpMail;
