import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB per file

const createStorage = (folder) =>
    new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => ({
            folder,
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
            transformation: [{ quality: "auto", fetch_format: "auto" }],
        }),
    });

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPG, PNG and WEBP are allowed.`), false);
    }
};

const multerOptions = (folder) => ({
    storage: createStorage(folder),
    limits: { fileSize: FILE_SIZE_LIMIT },
    fileFilter,
});

// Single-file uploaders (categories, etc.)
export const uploadCategory = multer(multerOptions("categories"));
export const uploadProduct = multer(multerOptions("products"));

// ── Mixed uploader for product create / update ────────────────────────────────
// Accepts TWO fields in one multipart request:
//   "image"   → the single main thumbnail        (maxCount: 1)
//   "gallery" → multiple extra gallery images    (maxCount: 10)
//
// Frontend must use:
//   formData.append("image",   mainImageFile);
//   galleryFiles.forEach(f => formData.append("gallery", f));
//
// Controller reads:
//   req.files["image"][0].path    → thumbnail URL
//   req.files["gallery"]           → array of gallery file objects
export const uploadProductMixed = multer(multerOptions("products")).fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
]);

const upload = multer(multerOptions("uploads"));
export default upload;
