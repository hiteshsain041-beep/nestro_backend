import nodemailer from "nodemailer";

/**
 * Send an OTP email.
 *
 * Call signatures:
 *   sendOtpMail(email, otp)                  → registration / resend OTP
 *   sendOtpMail(email, subject, htmlBody)     → custom subject + body (forgot-password)
 *
 * Returns: { success: true } on success.
 * Throws:  Error with a descriptive message on failure — callers MUST catch.
 *
 * ── Gmail requirements ────────────────────────────────────────────────────
 *  1. Enable 2-Step Verification on the Gmail account.
 *  2. Go to https://myaccount.google.com/apppasswords
 *  3. Create an App Password  →  copy the 16-character code.
 *  4. Set EMAIL_PASS=<16-char code>  in backend/.env  (no quotes, no spaces).
 *  5. EMAIL_USER must be the exact Gmail address used to generate the App Password.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Warn loudly at module load time if env vars are missing ─────────────────
// This surfaces configuration problems immediately on `npm start` rather than
// only when the first registration request arrives.
if (!process.env.EMAIL_USER) {
  console.error("[sendOtpMail] ⚠️  EMAIL_USER is not set in .env");
}
if (!process.env.EMAIL_PASS) {
  console.error("[sendOtpMail] ⚠️  EMAIL_PASS is not set in .env");
} else if (process.env.EMAIL_PASS === "your_16_char_app_password_here") {
  console.error(
    "[sendOtpMail] ⚠️  EMAIL_PASS is still the placeholder value.\n" +
    "   Go to https://myaccount.google.com/apppasswords and generate a real App Password.\n" +
    "   Then set EMAIL_PASS=<your-16-char-code> in backend/.env and restart the server."
  );
}

const sendOtpMail = async (toEmail, otp, customHtml) => {
  // ── Runtime guard — throw immediately with a clear message ──────────────
  if (!process.env.EMAIL_USER) {
    throw new Error("EMAIL_USER is not configured in .env");
  }
  if (!process.env.EMAIL_PASS) {
    throw new Error("EMAIL_PASS is not configured in .env");
  }
  if (process.env.EMAIL_PASS === "your_16_char_app_password_here") {
    throw new Error(
      "EMAIL_PASS is still a placeholder. " +
      "Generate a Gmail App Password at https://myaccount.google.com/apppasswords " +
      "and set it in backend/.env, then restart the server."
    );
  }

  // ── Create transporter ──────────────────────────────────────────────────
  // Using service:"gmail" lets Nodemailer resolve the correct SMTP host
  // (smtp.gmail.com), port (465/587), and TLS settings automatically.
  // Do NOT set host/port manually when using service:"gmail" — it causes
  // conflicts that can silently drop emails.
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,   // must be the full Gmail address
      pass: process.env.EMAIL_PASS,   // Gmail App Password (16 chars, no spaces)
    },
  });

  const isCustom = typeof customHtml === "string";

  // ── Default OTP template (registration / resend) ────────────────────────
  const defaultHtml = `
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
          <p style="color:#c9b9a8;font-size:12px;margin:0;">© 2026 Nestro · Curated Furniture</p>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Nestro" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    // 3-arg call: subject is in the `otp` parameter; body is in `customHtml`
    subject: isCustom ? otp : "Your Nestro Verification Code",
    html: isCustom ? customHtml : defaultHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[sendOtpMail] ✅ Email sent to ${toEmail} | messageId: ${info.messageId}`
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Surface the real SMTP error so it appears in backend logs
    console.error(`[sendOtpMail] ❌ Failed to send to ${toEmail}:`, err.message);

    // Provide actionable guidance for the most common Gmail errors
    if (err.message?.includes("535") || err.message?.includes("BadCredentials")) {
      throw new Error(
        "Gmail authentication failed (535 BadCredentials). " +
        "Make sure EMAIL_PASS is a 16-character Gmail App Password, NOT your regular Gmail password. " +
        "Generate one at https://myaccount.google.com/apppasswords"
      );
    }
    if (err.message?.includes("534") || err.message?.includes("Application-specific")) {
      throw new Error(
        "Gmail requires an App Password. " +
        "Enable 2-Step Verification, then generate an App Password at " +
        "https://myaccount.google.com/apppasswords"
      );
    }
    // Re-throw the original error for all other cases
    throw err;
  }
};

export default sendOtpMail;
