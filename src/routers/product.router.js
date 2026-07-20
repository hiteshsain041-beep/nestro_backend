import express from "express";
const router = express.Router();
import {
    create, get, deleteById, StatusUpdate,
    getById, update, StatusById, addImages, removeGalleryImage
} from "../controllers/product.controller.js";
import { uploadProduct, uploadProductMixed } from "../middleware/multer.js";
import { protect, authorize } from "../middleware/auth.js";

const admin = [protect, authorize("admin", "superAdmin")];

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/", get);
router.get("/:id", getById);

// ── Product create — uses mixed uploader: "image" + "gallery" ─────────────────
router.post(
    "/create",
    ...admin,
    uploadProductMixed,
    create
);

// ── Product update — uses mixed uploader: "image" + "gallery" ─────────────────
router.put(
    "/update/:id",
    ...admin,
    uploadProductMixed,
    update
);

// ── Remove a single gallery image from Cloudinary + MongoDB ───────────────────
router.delete(
    "/gallery/:productId/:imageId",
    ...admin,
    removeGalleryImage
);

// ── Status toggles ────────────────────────────────────────────────────────────
router.patch("/status-update/:id", ...admin, StatusUpdate);
router.patch("/status/:id", ...admin, StatusById);

// ── Delete product ────────────────────────────────────────────────────────────
router.delete("/delete/:id", ...admin, deleteById);

// ── Legacy bulk-image endpoint (kept for backward compatibility) ───────────────
router.post(
    "/add-multiple-images/:id",
    ...admin,
    uploadProduct.array("gallery", 10),
    addImages
);

export default router;
