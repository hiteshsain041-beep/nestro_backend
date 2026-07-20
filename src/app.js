// ─── STEP 1: Load environment variables FIRST — before any other import ────────
import "dotenv/config";

// ─── STEP 2: Validate all required environment variables at startup ─────────────
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
    console.error(
        "\n   Add the missing variables to backend/.env and restart the server.\n"
    );
    process.exit(1);
}

// ─── STEP 3: Application imports (env is guaranteed set by this point) ──────────
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

// ─── CORS — must be FIRST middleware so OPTIONS preflight is handled ───────────
// All allowed origins: Vercel production + any env-configured origins + localhost
const allowedOrigins = [
    "https://nestro-frontend-chi.vercel.app",   // Vercel production (hardcoded as safety net)
    process.env.CLIENT_URL,                      // e.g. https://nestro-frontend-chi.vercel.app
    process.env.CORS,                            // optional extra origin from env
    "http://localhost:3000",
    "http://localhost:3001",
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server / Postman (no origin header) + whitelisted origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin "${origin}" is not allowed`));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200, // some legacy browsers (IE11) choke on 204
};

// Handle ALL preflight OPTIONS requests before any other middleware
server.options("*", cors(corsOptions));

// Apply CORS to every request — BEFORE cookieParser / express.json / routes
server.use(cors(corsOptions));

// ─── Other Middleware ──────────────────────────────────────────────────────────
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

// ─── Global error handler ─────────────────────────────────────────────────────
server.use((err, req, res, next) => {
    console.error("[Express Error]", err.message);
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
        // console.log(`[Server] ✅  Running on http://localhost:${PORT}`);
    });
}

main();
