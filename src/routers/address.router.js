import express from "express";
const router = express.Router();
import { create, getAll, update, deleteById } from "../controllers/address.controller.js";
import { protect } from "../middleware/auth.js";

// All address routes require a logged-in user
router.post("/create", protect, create);
router.get("/", protect, getAll);
router.put("/update/:id", protect, update);
router.delete("/delete/:id", protect, deleteById);

export default router;
