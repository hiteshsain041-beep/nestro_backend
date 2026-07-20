import express from "express";
const router = express.Router();
import { register,  verifyOtp, resendOtp, login, getProfile, addAddress, logout, googleLogin, forgotPassword, resetPassword  } from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.js";

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.post("/add-address",protect, addAddress);
router.post("/logout", logout);
router.post("/google-login", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router