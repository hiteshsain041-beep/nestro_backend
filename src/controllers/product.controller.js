import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import ProductModel from "../models/product.model.js";
import CategoryModel from "../models/category.model.js";
import RoomModel from "../models/room.model.js";
import {
    sendBadRequest,
    sendConflict,
    sendCreated,
    sendNotFound,
    sendServerError,
    sendSuccess
} from "../utils/response.js";

// ── Helper: return true only for non-empty valid ObjectIds ────────────────────
function isValidId(value) {
    return value && String(value).trim() !== "" && mongoose.Types.ObjectId.isValid(value);
}

// ─── Helper: extract thumbnail path from either upload handler ────────────────
// uploadProductMixed (.fields()) puts the file in req.files["image"][0]
// uploadProduct.single()         puts the file in req.file
// This helper handles both so nothing breaks if a route ever uses .single().
function getThumbnailPath(req) {
    if (req.files && req.files["image"] && req.files["image"][0]) {
        return req.files["image"][0].path;
    }
    if (req.file) {
        return req.file.path;
    }
    return null;
}

// ─── Helper: extract gallery files from uploadProductMixed (.fields()) ─────────
function getGalleryFiles(req) {
    if (req.files && Array.isArray(req.files["gallery"])) {
        return req.files["gallery"];
    }
    return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/product
// ─────────────────────────────────────────────────────────────────────────────
const get = async (req, res) => {
    try {
        const query = req.query;
        const filter = {};
        const sortBy = {};
        const limit = query.limit ? parseInt(query.limit) : 30;
        const skip = query.skip ? parseInt(query.skip) : 0;

        if (query.stock) filter.stock = query.stock === "true";
        if (query.bestSeller) filter.bestSeller = query.bestSeller === "true";
        if (query.newArrival) filter.newArrival = query.newArrival === "true";
        if (query.featured) filter.featured = query.featured === "true";

        if (query.room) {
            const rooms = await RoomModel.find({ slug: { $in: query.room.split(",") } }).select("_id");
            filter.roomId = { $in: rooms.map(r => r._id) };
        }
        if (query.category) {
            const cats = await CategoryModel.find({ slug: { $in: query.category.split(",") } }).select("_id");
            filter.categoryId = { $in: cats.map(c => c._id) };
        }
        if (query.min && query.max) {
            filter.salePrice = { $gte: Number(query.min), $lte: Number(query.max) };
        }
        if (query.sort) {
            if (query.sort === "asc") sortBy.salePrice = 1;
            else if (query.sort === "desc") sortBy.salePrice = -1;
            else sortBy.createdAt = 1;
        }

        const products = await ProductModel
            .find(filter).limit(limit).skip(skip).sort(sortBy)
            .populate([
                { path: "roomId", select: "_id name slug" },
                { path: "categoryId", select: "_id name slug" }
            ]);

        const total = await ProductModel.countDocuments(filter);

        return res.status(200).json({
            success: true,
            message: "Data found",
            products,
            meta: { limit, total, skip, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("[product.get]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/product/:id
// ─────────────────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) return sendNotFound(res, "Product not found");
        return res.status(200).json({ success: true, message: "Data found", product });
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/product/create
// Accepts: field "image" (thumbnail) + field "gallery" (0-10 extra images)
// Both handled by uploadProductMixed middleware.
// ─────────────────────────────────────────────────────────────────────────────
const create = async (req, res) => {
    try {
        const {
            roomId, categoryId, name, slug,
            originalPrice, salePrice, discount,
            shortDescription, description,
            material, width, height, depth,
            weight, color, seoTitle, seoDescription
        } = req.body;

        // ── Validate required ObjectId fields BEFORE touching mongoose ─────────
        if (!isValidId(roomId)) {
            return sendBadRequest(res, "Room is required — please select a valid room.");
        }
        if (!isValidId(categoryId)) {
            return sendBadRequest(res, "Category is required — please select a valid category.");
        }
        if (!name || !slug) {
            return sendBadRequest(res, "Product name and slug are required.");
        }

        // ── Thumbnail (field: "image") ─────────────────────────────────────────
        const thumbnailPath = getThumbnailPath(req);
        const thumbnail = thumbnailPath || "";

        // ── Gallery (field: "gallery") ─────────────────────────────────────────
        const galleryFiles = getGalleryFiles(req);
        const gallery = galleryFiles.map(f => ({
            public_id: f.filename,
            url: f.path
        }));

        // Duplicate check
        const existing = await ProductModel.findOne({ $or: [{ slug }, { name }] });
        if (existing) return sendConflict(res, "Product already exists");

        await ProductModel.create({
            roomId, categoryId, name, slug,
            originalPrice, salePrice, discount,
            shortDescription, description,
            material,
            dimensions: { width, height, depth },
            weight, color, seoTitle, seoDescription,
            thumbnail,
            gallery
        });

        return sendCreated(res, "Product created successfully");
    } catch (error) {
        console.error("[product.create]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/product/update/:id
// Keeps existing gallery and appends any newly uploaded "gallery" files.
// ─────────────────────────────────────────────────────────────────────────────
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, slug, roomId, categoryId,
            originalPrice, salePrice, discount,
            shortDescription, description,
            material, width, height, depth,
            weight, color, seoTitle, seoDescription
        } = req.body;

        const oldProduct = await ProductModel.findById(id);
        if (!oldProduct) return sendNotFound(res, "Product not found");

        const dup = await ProductModel.findOne({ name, _id: { $ne: id } });
        if (dup) return sendConflict(res, "Product already exists");

        const updateData = {
            name, slug,
            originalPrice, salePrice, discount,
            shortDescription, description,
            material, dimensions: { width, height, depth },
            weight, color, seoTitle, seoDescription
        };

        // ── Only update roomId/categoryId if a valid value was sent ───────────
        if (isValidId(roomId)) updateData.roomId = roomId;
        if (isValidId(categoryId)) updateData.categoryId = categoryId;

        // ── New thumbnail uploaded? (field: "image") ──────────────────────────
        const thumbnailPath = getThumbnailPath(req);
        if (thumbnailPath) updateData.thumbnail = thumbnailPath;

        // ── New gallery images uploaded? (field: "gallery") ───────────────────
        const newGalleryFiles = getGalleryFiles(req);
        if (newGalleryFiles.length > 0) {
            const newEntries = newGalleryFiles.map(f => ({
                public_id: f.filename,
                url: f.path
            }));
            updateData.$push = { gallery: { $each: newEntries } };
        }

        await ProductModel.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
        return sendSuccess(res, "Product updated successfully");
    } catch (error) {
        console.error("[product.update]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/product/gallery/:productId/:imageId
// Removes one gallery image from Cloudinary then from MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
const removeGalleryImage = async (req, res) => {
    try {
        const { productId, imageId } = req.params;

        const product = await ProductModel.findById(productId);
        if (!product) return sendNotFound(res, "Product not found");

        const item = product.gallery.find(img => img._id.toString() === imageId);
        if (!item) return sendNotFound(res, "Gallery image not found");

        // Delete from Cloudinary (non-fatal — we still remove from DB)
        try {
            await cloudinary.uploader.destroy(item.public_id);
        } catch (cloudErr) {
            console.error("[removeGalleryImage] Cloudinary delete failed:", cloudErr.message);
        }

        // Remove from MongoDB
        await ProductModel.findByIdAndUpdate(
            productId,
            { $pull: { gallery: { _id: item._id } } }
        );

        const updated = await ProductModel.findById(productId);
        return res.status(200).json({
            success: true,
            message: "Gallery image removed",
            gallery: updated.gallery
        });
    } catch (error) {
        console.error("[product.removeGalleryImage]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/product/delete/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteById = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) return sendNotFound(res);
        await ProductModel.findByIdAndDelete(req.params.id);
        return sendSuccess(res, "Deleted successfully");
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/product/status-update/:id  — toggle product.status
// ─────────────────────────────────────────────────────────────────────────────
const StatusUpdate = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) return sendNotFound(res);
        await ProductModel.findByIdAndUpdate(req.params.id, { $set: { status: !product.status } });
        return sendSuccess(res, "Status updated");
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/product/status/:id  — toggle any boolean flag
// ─────────────────────────────────────────────────────────────────────────────
const StatusById = async (req, res) => {
    try {
        const { id } = req.params;
        const { flag } = req.body;
        const product = await ProductModel.findById(id);
        if (!product) return sendNotFound(res);
        await ProductModel.findByIdAndUpdate(id, { $set: { [flag]: !product[flag] } });
        return sendSuccess(res, "Status updated");
    } catch (error) {
        console.error("[product.StatusById]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/product/add-multiple-images/:id  (legacy bulk-add endpoint)
// ─────────────────────────────────────────────────────────────────────────────
const addImages = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) return sendNotFound(res);

        // This route still uses uploadProduct.array("gallery") so req.files is an array
        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0) return sendBadRequest(res, "Please upload images");

        const newEntries = files.map(f => ({ public_id: f.filename, url: f.path }));
        product.gallery.push(...newEntries);
        await product.save();

        return sendSuccess(res, "Images added successfully");
    } catch (error) {
        console.error("[product.addImages]", error.message);
        return sendServerError(res, error);
    }
};

export {
    get, create, update, deleteById, getById,
    StatusUpdate, StatusById, addImages, removeGalleryImage
};
