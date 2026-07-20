import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";
import { sendServerError } from "../utils/response.js";

/**
 * protect — verify the JWT from either:
 *   1. httpOnly cookie  →  req.cookies.jwt
 *   2. Authorization header  →  "Bearer <token>"
 *
 * On success  → attaches req.user (password/otp fields stripped)
 * On failure  → 401 JSON response
 */
export const protect = async (req, res, next) => {
    try {
        let token = null;

        // ── 1. Cookie (preferred — sent automatically by browser) ──────────────
        if (req.cookies?.jwt) {
            token = req.cookies.jwt;
        }

        // ── 2. Authorization header fallback (mobile / Postman / SSR) ──────────
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            // Accept both "Bearer <token>" and raw "<token>"
            token = authHeader.startsWith("Bearer ")
                ? authHeader.slice(7)
                : authHeader;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized — no token provided",
            });
        }

        // ── Verify signature & expiry ───────────────────────────────────────────
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            // Clear stale cookie if one was sent
            res.clearCookie("jwt", { httpOnly: true, sameSite: "lax" });
            return res.status(401).json({
                success: false,
                message: "Unauthorized — token is invalid or expired, please log in again",
            });
        }

        // ── Load user from DB (never expose sensitive fields) ──────────────────
        const user = await UserModel.findById(decoded.id).select(
            "-password -otp -otpExpire -__v"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized — account no longer exists",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("[auth.protect]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

/**
 * authorize(...roles) — role-based access control.
 * Must be used AFTER protect.
 *
 * Example:  router.delete("/x", protect, authorize("admin", "superAdmin"), handler)
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden — you do not have permission to perform this action",
            });
        }
        next();
    };
};
