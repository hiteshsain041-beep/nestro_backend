import UserModel from "../models/user.model.js";
import {
  sendBadRequest,
  sendConflict,
  sendCreated,
  sendUnauthorized,
  sendNotFound,
  sendServerError,
  sendSuccess,
} from "../utils/response.js";
import sendOtpMail from "../utils/sendOtpMail.js";
import Cryptr from "cryptr";
import generateToken from "../utils/generateToken.js";

// ─── Reusable OTP email HTML builder ─────────────────────────────────────────
/**
 * buildOtpEmailHtml(otp, heading, subtext)
 * Generates a branded Nestro HTML email with the OTP in a highlighted box.
 */
function buildOtpEmailHtml(otp, heading, subtext) {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#faf8f5;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(58,36,24,0.08);">
        <div style="background:#2b180f;padding:28px 32px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;letter-spacing:6px;margin:0;font-weight:700;">NESTRO.</h1>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#1a1007;font-size:20px;margin:0 0 8px;">${heading}</h2>
          <p style="color:#9a8a7a;font-size:14px;margin:0 0 28px;line-height:1.6;">
            ${subtext}
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

// ─── Cryptr singleton ─────────────────────────────────────────────────────────
// Lazily initialised so dotenv is guaranteed to have run before we read the var.
// Using CRYPTR_SECRET (separate from JWT_SECRET — different concerns).
let _cryptr;
function getCryptr() {
  if (!_cryptr) {
    const secret = process.env.CRYPTR_SECRET;
    if (!secret) {
      throw new Error(
        "[getCryptr] CRYPTR_SECRET is not set in .env. " +
        "Add CRYPTR_SECRET=<your-secret> to backend/.env and restart."
      );
    }
    _cryptr = new Cryptr(secret);
  }
  return _cryptr;
}

// ─── Cookie options ───────────────────────────────────────────────────────────
const COOKIE_OPTIONS = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

// Role cookie — NOT httpOnly so Next.js middleware (Edge runtime) can read it.
// It is not sensitive: the real auth gate is the httpOnly jwt cookie verified
// by the protect middleware. This is only used for client-side routing decisions.
const ROLE_COOKIE_OPTIONS = {
  maxAge: 30 * 24 * 60 * 60 * 1000,
  httpOnly: false, // must be false — Edge middleware cannot read httpOnly cookies
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/register
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  console.log("[register] Hit — body:", { name: req.body?.name, email: req.body?.email });
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return sendBadRequest(res, "Name, email and password are required");
    }

    // 409 — email already registered
    const existing = await UserModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      return sendConflict(res, "An account with this email already exists");
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpire = Date.now() + 3 * 60 * 1000; // 3 minutes

    // Create user FIRST — so registration never fails due to email issues
    const passwordHash = getCryptr().encrypt(password);
    await UserModel.create({
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      otp,
      otpExpire,
    });
    console.log("[register] User created:", email.toLowerCase());

    // Send OTP email — wrapped in try/catch so email failure never blocks response
    let emailSent = true;
    let emailError = null;
    console.log("[register] Sending OTP email...");
    try {
      await sendOtpMail(
        email.toLowerCase(),
        "Nestro — Verify your email",
        buildOtpEmailHtml(
          otp,
          "Verify Your Email",
          "Use the OTP below to complete your Nestro account verification. It expires in <strong>3 minutes</strong>."
        )
      );
      console.log("[register] OTP email sent successfully");
    } catch (emailErr) {
      emailSent = false;
      emailError = emailErr.message;
      console.error("[register] Email failed (non-fatal):", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      user: email.toLowerCase(),
      message: emailSent
        ? "Registered successfully. Check your email for the OTP."
        : "Account created but email could not be sent. Please use Resend OTP.",
      emailSent,
      // Only expose email error detail in non-production for debugging
      ...(process.env.NODE_ENV !== "production" && emailError
        ? { emailError }
        : {}),
    });
  } catch (error) {
    console.error("[user.register] Error:", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendBadRequest(res, "Email and OTP are required");
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return sendNotFound(res, "User not found");

    // Wrong OTP
    if (String(user.otp) !== String(otp)) {
      return sendBadRequest(res, "Invalid OTP");
    }

    // Expired OTP
    if (Date.now() > user.otpExpire) {
      return sendBadRequest(res, "OTP has expired. Please request a new one.");
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    return sendSuccess(res, "Email verified successfully. You can now log in.");
  } catch (error) {
    console.error("[user.verifyOtp]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/resend-otp
// ─────────────────────────────────────────────────────────────────────────────
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return sendBadRequest(res, "Email is required");

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return sendNotFound(res, "User not found");

    if (user.isVerified) {
      return sendBadRequest(res, "This account is already verified");
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpire = Date.now() + 3 * 60 * 1000;

    await sendOtpMail(
      email.toLowerCase(),
      "Nestro — Your new verification OTP",
      buildOtpEmailHtml(
        otp,
        "Your New OTP",
        "Use the new OTP below to complete your Nestro account verification. It expires in <strong>3 minutes</strong>."
      )
    );

    user.otp = otp;
    user.otpExpire = otpExpire;
    await user.save();

    return sendSuccess(res, "OTP resent successfully. Please check your email.");
  } catch (error) {
    console.error("[user.resendOtp]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequest(res, "Email and password are required");
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return sendNotFound(res, "No account found with this email");

    // Google-only accounts have no password set
    if (!user.password) {
      return sendUnauthorized(
        res,
        "This account was created with Google. Please use Google Login."
      );
    }

    // Decrypt and compare
    let decryptedPassword;
    try {
      decryptedPassword = getCryptr().decrypt(user.password);
    } catch {
      return sendServerError(res, new Error("Password decryption failed"));
    }

    if (decryptedPassword !== password) {
      return sendUnauthorized(res, "Incorrect password");
    }

    if (!user.isVerified) {
      return sendUnauthorized(
        res,
        "Please verify your email before logging in"
      );
    }

    const token = generateToken(user._id);

    res.cookie("jwt", token, COOKIE_OPTIONS);
    res.cookie("role", user.role, ROLE_COOKIE_OPTIONS);

    // Return user without sensitive fields
    const safeUser = await UserModel.findById(user._id).select(
      "-password -otp -otpExpire -__v"
    );

    // Include token in JSON body so the Next.js proxy route (/api/auth/login)
    // can re-set the cookie on the frontend domain without parsing Set-Cookie headers
    return sendSuccess(res, "Login successful", { user: safeUser, token });
  } catch (error) {
    console.error("[user.login]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/google-login
// ─────────────────────────────────────────────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { name, email, photo, uid } = req.body;

    if (!email) {
      return sendBadRequest(res, "Email is required for Google login");
    }

    let user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create a new Google-authenticated user.
      // password is set to a placeholder — Google users cannot log in with
      // email+password anyway because they have no plaintext password stored.
      user = await UserModel.create({
        name,
        email: email.toLowerCase(),
        image: photo || "",
        googleId: uid || "",
        isVerified: true,
        password: "GOOGLE_OAUTH_NO_PASSWORD", // sentinel — never decrypted
      });
    } else if (!user.googleId) {
      // Existing email/password account — link the Google ID
      user.googleId = uid || "";
      if (photo) user.image = photo;
      user.isVerified = true;
      await user.save();
    }

    const token = generateToken(user._id);
    res.cookie("jwt", token, COOKIE_OPTIONS);
    res.cookie("role", user.role, ROLE_COOKIE_OPTIONS);

    const safeUser = await UserModel.findById(user._id).select(
      "-password -otp -otpExpire -__v"
    );

    // Include token in JSON body so the Next.js proxy route (/api/auth/login)
    // can re-set the cookie on the frontend domain without parsing Set-Cookie headers
    return sendSuccess(res, "Google login successful", { user: safeUser, token });
  } catch (error) {
    console.error("[user.googleLogin]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/profile  (protected)
// ─────────────────────────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    // req.user is attached by the protect middleware (already stripped of sensitive fields)
    if (!req.user) return sendNotFound(res, "User not found");

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      user: req.user,
    });
  } catch (error) {
    console.error("[user.getProfile]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/add-address  (protected)
// ─────────────────────────────────────────────────────────────────────────────
const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const address = req.body;

    const user = await UserModel.findById(userId);
    if (!user) return sendNotFound(res, "User not found");

    user.addresses.push(address);
    await user.save();

    return res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    console.error("[user.addAddress]", err.message, err.stack);
    return sendServerError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/logout
// ─────────────────────────────────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  // Clear the role cookie set at login (non-httpOnly companion cookie)
  res.clearCookie("role", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendBadRequest(res, "Email is required");
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return sendNotFound(res, "No account found with that email");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const html = `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#faf8f5;padding:40px 20px;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(58,36,24,0.08);">
          <div style="background:#2b180f;padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;letter-spacing:6px;margin:0;font-weight:700;">NESTRO.</h1>
          </div>
          <div style="padding:36px 32px;">
            <h2 style="color:#1a1007;font-size:20px;margin:0 0 8px;">Reset Your Password</h2>
            <p style="color:#9a8a7a;font-size:14px;margin:0 0 28px;line-height:1.6;">
              Your OTP expires in <strong>10 minutes</strong>.
            </p>
            <div style="background:#faf0e8;border:2px dashed #d9b48b;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="color:#9a8a7a;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">OTP Code</p>
              <h1 style="color:#3a2418;font-size:42px;letter-spacing:10px;margin:0;font-weight:800;font-family:monospace;">${otp}</h1>
            </div>
            <p style="color:#9a8a7a;font-size:13px;line-height:1.6;margin:0;">Didn't request this? Ignore this email.</p>
          </div>
          <div style="border-top:1px solid #f0ebe4;padding:20px 32px;text-align:center;">
            <p style="color:#c9b9a8;font-size:12px;margin:0;">&#169; 2026 Nestro &middot; Curated Furniture</p>
          </div>
        </div>
      </div>
    `;

    // Send email FIRST — only persist OTP if it succeeds
    await sendOtpMail(email, "Nestro — Password Reset OTP", html);

    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    return res.json({
      success: true,
      message: "OTP sent successfully. Check your email.",
    });
  } catch (error) {
    console.error("[user.forgotPassword]", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP. Please try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/reset-password
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return sendBadRequest(res, "Email, OTP and new password are required");
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return sendNotFound(res, "User not found");

    // Wrong OTP
    if (String(user.otp) !== String(otp)) {
      return sendBadRequest(res, "Invalid OTP");
    }

    // Expired OTP
    if (user.otpExpire < Date.now()) {
      return sendBadRequest(res, "OTP has expired. Please request a new one.");
    }

    user.password = getCryptr().encrypt(password);
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("[user.resetPassword]", error.message, error.stack);
    return sendServerError(res, error);
  }
};

export {
  forgotPassword,
  resetPassword,
  register,
  verifyOtp,
  resendOtp,
  login,
  getProfile,
  addAddress,
  logout,
  googleLogin,
};
