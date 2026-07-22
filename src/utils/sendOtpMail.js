import nodemailer from "nodemailer";

/**
 * Send a transactional email via Gmail SMTP (Nodemailer).
 *
 * Supports two call signatures:
 *   sendOtpMail(toEmail, otp)                — registration / resend OTP (default template)
 *   sendOtpMail(toEmail, subject, htmlBody)   — custom subject + body (forgot-password etc.)
 *
 * Required env vars:
 *   EMAIL_USER       — full Gmail address  (e.g. you@gmail.com)
 *   EMAIL_PASS       — 16-char Gmail App Password  (NOT your regular password)
 *   EMAIL_SMTP_PORT  — (optional) SMTP port, defaults to 465
 *   EMAIL_FROM_NAME  — (optional) display name, defaults to "Nestro"
 *
 * Gmail setup:
 *   1. Enable 2-Step Verification on the account.
 *   2. Go to https://myaccount.google.com/apppasswords
 *   3. Create an App Password — copy the 16 characters (no spaces).
 *   4. Set EMAIL_PASS=<16chars> in Render env vars (no quotes, no spaces).
 */

// Warn at import time — surfaces config problems immediately on server start
if (!process.env.EMAIL_USER) {
  console.error("[sendOtpMail] ⚠️  EMAIL_USER is not set in env vars");
}
if (!process.env.EMAIL_PASS) {
  console.error("[sendOtpMail] ⚠️  EMAIL_PASS is not set in env vars");
}

// ── Cached transporter — created once, reused for all requests ────────────────
// Port 465 with secure:true uses SSL/TLS from the start (no STARTTLS upgrade).
// This is more reliable than port 587 on cloud platforms where STARTTLS handshake
// can time out. family:4 forces IPv4 DNS to prevent ENETUNREACH on Render.
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: Number(process.env.EMAIL_SMTP_PORT || 465),
    secure: true,          // SSL/TLS from connection start (port 465)
    family: 4,             // force IPv4 — avoids ENETUNREACH on Render
    connectionTimeout: 60_000,        // 60 s to establish TCP connection
    greetingTimeout: 30_000,        // 30 s for SMTP greeting
    socketTimeout: 60_000,        // 60 s for socket inactivity
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      servername: "smtp.gmail.com",
      minVersion: "TLSv1.2",
    },
  });

  return _transporter;
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
            If you didn't request this, you can safely ignore this email.
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
  // ── Runtime guards ───────────────────────────────────────────────────────
  if (!process.env.EMAIL_USER) {
    throw new Error("EMAIL_USER is not configured in env vars");
  }
  if (!process.env.EMAIL_PASS) {
    throw new Error("EMAIL_PASS is not configured in env vars");
  }

  // ── Resolve subject + html from call signature ───────────────────────────
  // 2-arg: sendOtpMail(email, otp)           → use default branded template
  // 3-arg: sendOtpMail(email, subject, html)  → use caller-provided content
  const isCustom = typeof htmlBody === "string" && htmlBody.trim().length > 0;
  const subject = isCustom ? subjectOrOtp : "Your Nestro Verification Code";
  const html = isCustom ? htmlBody : buildDefaultHtml(subjectOrOtp);

  // Plain-text fallback for email clients that don't render HTML
  const text = isCustom
    ? subject
    : `Your Nestro OTP code is: ${subjectOrOtp}\nIt expires in 3 minutes.\nIf you didn't request this, ignore this email.`;

  const fromName = process.env.EMAIL_FROM_NAME || "Nestro";

  const mailOptions = {
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
    text,
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendOtpMail] ✅ Email sent to ${toEmail} | messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[sendOtpMail] ❌ Failed to send to ${toEmail}:`, err.message);

    // ── Actionable error messages for common Gmail/network failures ───────
    if (err.code === "ETIMEDOUT" || err.code === "ENETUNREACH") {
      throw new Error(
        `Gmail SMTP connection failed (${err.code}) on port ${process.env.EMAIL_SMTP_PORT || 465}. ` +
        "Ensure Render allows outbound TCP on port 465. " +
        "Alternatively set EMAIL_SMTP_PORT=587 and check if port 587 is reachable."
      );
    }
    if (err.message?.includes("535") || err.message?.includes("BadCredentials")) {
      throw new Error(
        "Gmail authentication failed (535 BadCredentials). " +
        "EMAIL_PASS must be a 16-character Gmail App Password — NOT your regular Gmail password. " +
        "Generate one at https://myaccount.google.com/apppasswords"
      );
    }
    if (err.message?.includes("534") || err.message?.includes("Application-specific")) {
      throw new Error(
        "Gmail requires an App Password. " +
        "Enable 2-Step Verification at myaccount.google.com/security, " +
        "then generate an App Password at https://myaccount.google.com/apppasswords"
      );
    }

    throw err; // re-throw all other errors unchanged
  }
};

export default sendOtpMail;
