import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        // Cryptr-encrypted for email/password accounts.
        // Set to "GOOGLE_OAUTH_NO_PASSWORD" for Google-only accounts.
        // Not required at the schema level — validation is in the controller.
        password: {
            type: String,
            default: "",
        },

        mobile: {
            type: String,
            default: null,
        },

        // ── OAuth ───────────────────────────────────────────────────────────────
        googleId: {
            type: String,
            default: null,
        },

        image: {
            type: String,
            default: "",
        },

        role: {
            type: String,
            enum: ["user", "admin", "superAdmin"],
            default: "user",
        },

        addresses: {
            type: [
                {
                    fullName: { type: String, required: true },
                    mobile: { type: String, required: true },
                    pincode: { type: String, required: true },
                    addressLine: { type: String, required: true },
                    city: { type: String, required: true },
                    state: { type: String, required: true },
                    country: { type: String, default: "India" },
                    isDefault: { type: Boolean, default: false },
                },
            ],
            default: [],
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        otp: {
            type: String, // stored as string so leading zeros are preserved
        },

        otpExpire: {
            type: Date,
        },

        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
