import express from "express";
const router = express.Router();

import { create, getAll, toggleRead, deleteById } from "../controllers/contact.controller.js";
import { protect, authorize } from "../middleware/auth.js";

// Public — anyone can submit the contact form
router.post("/", create);

// Admin only
router.get("/", protect, authorize("admin", "superAdmin"), getAll);
router.patch("/:id/read", protect, authorize("admin", "superAdmin"), toggleRead);
router.delete("/:id", protect, authorize("admin", "superAdmin"), deleteById);

export default router;
