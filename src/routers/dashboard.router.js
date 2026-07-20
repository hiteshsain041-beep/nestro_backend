import express from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// GET /api/admin/dashboard — admin & superAdmin only
router.get("/dashboard", protect, authorize("admin", "superAdmin"), getDashboard);

export default router;
