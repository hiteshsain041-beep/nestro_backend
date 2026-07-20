// ─── Load env vars FIRST ─────────────────────────────────────────────────────
import "dotenv/config";

import mongoose from "mongoose";
import Cryptr from "cryptr";
import UserModel from "./src/models/user.model.js";

// ─── Guard: ensure required vars are present ─────────────────────────────────
if (!process.env.CRYPTR_SECRET) {
    console.error("[createAdmin] ❌  CRYPTR_SECRET is not set in backend/.env");
    process.exit(1);
}
if (!process.env.MONGODB_URL) {
    console.error("[createAdmin] ❌  MONGODB_URL is not set in backend/.env");
    process.exit(1);
}

const cryptr = new Cryptr(process.env.CRYPTR_SECRET);

await mongoose.connect(process.env.MONGODB_URL);
console.log("[createAdmin] ✅  DB connected");

const email = "admin@nestro.com";
const password = "Admin@1234";

let user = await UserModel.findOne({ email });

if (user) {
    user.role = "admin";
    user.isVerified = true;
    user.password = cryptr.encrypt(password);
    await user.save();
    console.log("[createAdmin] ✅  Existing user updated to admin");
} else {
    await UserModel.create({
        name: "Admin",
        email,
        password: cryptr.encrypt(password),
        role: "admin",
        isVerified: true,
    });
    console.log("[createAdmin] ✅  New admin user created");
}

console.log("[createAdmin] 📧  Email   :", email);
console.log("[createAdmin] 🔑  Password:", password);

await mongoose.disconnect();
process.exit(0);
