import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "rooms",
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "categories",
        required: true
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },

    originalPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    discount: { type: Number, required: true },

    shortDescription: { type: String },
    description: { type: String },
    material: { type: String },
    dimensions: {
        width: Number,
        height: Number,
        depth: Number
    },
    weight: { type: Number },
    featured: { type: Boolean, default: false },
    color: { type: String },
    bestSeller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },

    // ── Main product image (Cloudinary URL stored as a plain string) ───────────
    thumbnail: { type: String },

    // ── Gallery: each entry stores the Cloudinary public_id (for deletion)
    //    and the full https URL (for display). ─────────────────────────────────
    gallery: [
        {
            public_id: { type: String, required: true },
            url: { type: String, required: true }
        }
    ],

    seoTitle: String,
    seoDescription: String,
    stock: { type: Boolean, default: true },
    status: { type: Boolean, default: true }
}, { timestamps: true });

const ProductModel = mongoose.model("Product", productSchema);
export default ProductModel;
