import express from "express";
const router = express.Router();
import { create, get, deleteById, StatusUpdate, getById, update } from "../controllers/category.controller.js";
import { uploadCategory } from "../middleware/multer.js";
import { protect, authorize } from "../middleware/auth.js";

router.get("/", get);
router.get("/:id", getById);
router.post("/create", protect, authorize("admin", "superAdmin"), uploadCategory.single("image"), create);
router.patch("/status-update/:id", protect, authorize("admin", "superAdmin"), StatusUpdate);
router.put("/update/:id", protect, authorize("admin", "superAdmin"), uploadCategory.single("image"), update);
router.delete("/delete/:id", protect, authorize("admin", "superAdmin"), deleteById);

export default router