import "dotenv/config";
import dns from "node:dns";

// Force IPv4 DNS resolution — prevents ENETUNREACH on Render (IPv6 not routable)
dns.setDefaultResultOrder("ipv4first");

const REQUIRED_ENV = [
    "JWT_SECRET",
    "CRYPTR_SECRET",
    "MONGODB_URL",
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "CLOUD_NAME",
    "API_KEY",
    "CLOUDINARY_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error("\n[Startup] ❌  Missing required environment variables:");
    missing.forEach((key) => console.error(`   • ${key}`));
    process.exit(1);
}

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/connectDB.js";
import categoryRouter from "./routers/category.router.js";
import roomRouter from "./routers/room.router.js";
import productRouter from "./routers/product.router.js";
import userRouter from "./routers/user.router.js";
import cartRouter from "./routers/cart.router.js";
import orderRouter from "./routers/order.router.js";
import addressRouter from "./routers/address.router.js";
import contactRouter from "./routers/contact.router.js";
import dashboardRouter from "./routers/dashboard.router.js";

const server = express();

// ─── Allowed Origins ──────────────────────────────────────────────────────────
const allowedOrigins = [
    ...new Set([
        "https://nestro-frontend-chi.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.CLIENT_URL,
        process.env.CORS,
    ].filter(Boolean))
];

console.log("[Server] Allowed origins:", allowedOrigins);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked: "${origin}"`);
            callback(new Error(`CORS: origin "${origin}" is not allowed`));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cookie",
        "X-Requested-With",
    ],
    exposedHeaders: ["Set-Cookie"],
    credentials: true,
    optionsSuccessStatus: 200,
};

// ─── Middleware ───────────────────────────────────────────────────────────────
server.use(cors(corsOptions));  // ✅ Ye khud OPTIONS handle karta hai
server.use(cookieParser());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
server.use("/api/category", categoryRouter);
server.use("/api/room-type", roomRouter);
server.use("/api/product", productRouter);
server.use("/api/user", userRouter);
server.use("/api/cart", cartRouter);
server.use("/api/order", orderRouter);
server.use("/api/address", addressRouter);
server.use("/api/contact", contactRouter);
server.use("/api/admin", dashboardRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
server.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
    });
});

// ─── Test Email (Brevo) ───────────────────────────────────────────────────────
// GET /api/test-email?to=you@example.com
// Works in ALL environments — use this to verify Brevo integration on Render
server.get("/api/test-email", async (req, res) => {
    const to = req.query.to;
    if (!to || !to.includes("@")) {
        return res.status(400).json({
            success: false,
            message: "Provide ?to=email@example.com in the query string",
        });
    }
    try {
        const { default: sendOtpMail } = await import("./utils/sendOtpMail.js");
        const result = await sendOtpMail(
            to,
            "Nestro — Brevo Integration Test",
            `<div style="font-family:Arial,sans-serif;padding:32px;background:#faf8f5;">
              <h2 style="color:#2b180f;">✅ Brevo is Working!</h2>
              <p style="color:#9a8a7a;">This test email confirms your Nestro backend
              can send transactional emails via Brevo REST API.</p>
              <p style="color:#c9b9a8;font-size:12px;">Sent at: ${new Date().toISOString()}<br>
              Server: ${process.env.RENDER_SERVICE_NAME || "localhost"}</p>
            </div>`
        );
        return res.json({
            success: true,
            message: `Test email sent successfully to ${to}`,
            messageId: result.messageId,
            brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
            brevoKeyPrefix: (process.env.BREVO_API_KEY || "").slice(0, 12) + "...",
        });
    } catch (err) {
        console.error("[test-email]", err.message);
        return res.status(500).json({
            success: false,
            message: err.message,
            brevoKeySet: Boolean(process.env.BREVO_API_KEY),
            brevoSenderSet: Boolean(process.env.BREVO_SENDER_EMAIL),
            brevoKeyPrefix: (process.env.BREVO_API_KEY || "").slice(0, 12) + "...",
            tip: "Ensure BREVO_API_KEY and BREVO_SENDER_EMAIL are set in Render Environment Variables",
        });
    }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
server.use((err, req, res, next) => {
    console.error("[Express Error]", err.message);

    if (err.message?.startsWith("CORS:")) {
        return res.status(403).json({
            success: false,
            message: err.message,
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error",
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`[Server] ✅  Running on port ${PORT}`);
    });
}

main();