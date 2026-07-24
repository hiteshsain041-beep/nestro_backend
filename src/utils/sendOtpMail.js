/**
 * sendOtpMail — Brevo (formerly Sendinblue) transactional email via REST API.
 *
 * Uses the native fetch API (Node 18+) — NO external SDK, NO Nodemailer.
 *
 * Call signatures (backward-compatible):
 *   sendOtpMail(toEmail, otp)                  → registration / resend OTP
 *   sendOtpMail(toEmail, subject, htmlBody)     → custom email (forgot-password etc.)
 *
 * Required env vars:
 *   BREVO_API_KEY      — from Brevo dashboard → Settings → API Keys
 *   BREVO_SENDER_EMAIL — verified sender in Brevo (Senders & IPs → Senders)
 *   BREVO_SENDER_NAME  — (optional) display name, defaults to "Nestro"
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// ── Module-load guard ─────────────────────────────────────────────────────────
if (!process.env.BREVO_API_KEY) {
  console.error("[sendOtpMail] ⚠️  BREVO_API_KEY is not set in env vars");
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.error("[sendOtpMail] ⚠️  BREVO_SENDER_EMAIL is not set in env vars");
}

// ── Branded OTP HTML template ─────────────────────────────────────────────────
function buildDefaultHtml(otp) {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#faf8f5;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(58,36,24,0.08);">
        <div style="background:#2b180f;padding:28px 32px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;letter-spacing:6px;margin:0;font-weight:700;">NESTRO.</h1>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#1a1007;font-size:20px;margin:0 0 8px;">Verify Your Email</h2>
          <p style="color:#9a8a7a;font-size:14px;margin:0 0 28px;line-height:1.6;">
            Use the OTP below to complete your verification.
            It expires in <strong>3 minutes</strong>.
          </p>
          <div style="background:#faf0e8;border:2px dashed #d9b48b;border-radius:16px;
                      padding:24px;text-align:center;margin-bottom:28px;">
            <p style="color:#9a8a7a;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">
              Your OTP Code
            </p>
            <h1 style="color:#3a2418;font-size:42px;letter-spacing:10px;margin:0;
                       font-weight:800;font-family:monospace;">${otp}</h1>
          </div>
          <p style="color:#9a8a7a;font-size:13px;line-height:1.6;margin:0;">
            If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </div>
        <div style="border-top:1px solid #f0ebe4;padding:20px 32px;text-align:center;">
          <p style="color:#c9b9a8;font-size:12px;margin:0;">&#169; 2026 Nestro &middot; Curated Furniture</p>
        </div>
      </div>
    </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
const sendOtpMail = async (toEmail, subjectOrOtp, htmlBody) => {
  // Runtime guards
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured in env vars");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is not configured in env vars");
  }
  if (!toEmail || !toEmail.includes("@")) {
    throw new Error(`Invalid recipient email: "${toEmail}"`);
  }

  // Resolve subject + html
  const isCustom = typeof htmlBody === "string" && htmlBody.trim().length > 0;
  const subject = isCustom ? subjectOrOtp : "Your Nestro Verification Code";
  const html = isCustom ? htmlBody : buildDefaultHtml(subjectOrOtp);

  // Build Brevo payload
  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || "Nestro",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
  };

  // ── Guard: detect placeholder API key immediately without network call ──────
  if (
    process.env.BREVO_API_KEY === "your-brevo-api-key-here" ||
    process.env.BREVO_API_KEY.length < 20
  ) {
    throw new Error(
      "BREVO_API_KEY looks like a placeholder — replace it with a real key from https://app.brevo.com/settings/keys/api"
    );
  }

  // 8-second timeout — fail fast so registration response is never blocked
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  let response;
  try {
    response = await fetch(BREVO_URL, {
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
      throw new Error("Brevo email failed: request timed out after 8 seconds");
    }
    throw new Error(`Brevo email failed: network error — ${fetchErr.message}`);
  }
  clearTimeout(timer);

  // Parse response safely
  const raw = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* non-JSON response */ }

  if (!response.ok) {
    const detail =
      parsed?.message || parsed?.error || raw || `HTTP ${response.status}`;
    console.error(
      `[sendOtpMail] ❌ Brevo error ${response.status} → ${toEmail}:`,
      detail
    );
    throw new Error(`Brevo email failed (${response.status}): ${detail}`);
  }

  const messageId = parsed?.messageId ?? "unknown";
  console.log(`[sendOtpMail] ✅ Email sent → ${toEmail} | messageId: ${messageId}`);
  return { success: true, messageId };
};

export default sendOtpMail;
