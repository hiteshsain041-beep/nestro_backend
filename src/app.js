import "dotenv/config";

const REQUIRED_ENV = [
    "JWT_SECRET",
    "CRYPTR_SECRET",
    "MONGODB_URL",
    "EMAIL_USER",
    "EMAIL_PASS",
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