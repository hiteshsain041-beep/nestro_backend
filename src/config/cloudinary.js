import { v2 as cloudinary } from "cloudinary";

// ── Validate env vars at module load time ─────────────────────────────────────
// This surfaces misconfiguration immediately on server start rather than
// silently failing on the first upload request.
const CLOUD_NAME = process.env.CLOUD_NAME;
const API_KEY = process.env.API_KEY;
const CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET;

if (!CLOUD_NAME || !API_KEY || !CLOUDINARY_SECRET) {
    console.error(
        "[Cloudinary] ❌  One or more credentials are missing in backend/.env\n" +
        `   CLOUD_NAME       : ${CLOUD_NAME ? "✅ set" : "❌ MISSING"}\n` +
        `   API_KEY          : ${API_KEY ? "✅ set" : "❌ MISSING"}\n` +
        `   CLOUDINARY_SECRET: ${CLOUDINARY_SECRET ? "✅ set" : "❌ MISSING"}\n` +
        "   Get these values from: https://console.cloudinary.com → Dashboard\n"
    );
}

// CLOUD_NAME must be the lowercase slug shown in the Cloudinary dashboard URL,
// e.g. "dk2hhhycd" — NOT the display name like "NESTRO".
if (CLOUD_NAME && CLOUD_NAME !== CLOUD_NAME.toLowerCase()) {
    console.warn(
        `[Cloudinary] ⚠️  CLOUD_NAME="${CLOUD_NAME}" contains uppercase letters.\n` +
        "   Cloudinary cloud names are always lowercase slugs.\n" +
        "   Check: https://console.cloudinary.com → Dashboard → Cloud Name\n"
    );
}

cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: CLOUDINARY_SECRET,
    secure: true,   // always return https:// URLs
});

export default cloudinary;
