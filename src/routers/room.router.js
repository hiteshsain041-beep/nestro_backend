import express from "express";
const router = express.Router();
import { create, get, deleteById, StatusUpdate, getById, update } from "../controllers/room.controller.js";
import { protect, authorize } from "../middleware/auth.js";

router.get("/", get);
router.post("/create", protect, authorize("admin", "superAdmin"), create);
router.patch("/status-update/:id", protect, authorize("admin", "superAdmin"), StatusUpdate);
router.put("/update/:id", protect, authorize("admin", "superAdmin"), update);
router.delete("/delete/:id", protect, authorize("admin", "superAdmin"), deleteById);
router.get("/:id", getById);

export default router