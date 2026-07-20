import express from "express";
const router = express.Router();
import {
    syncCart,
    addToCart,
    removeFromCart,
    updateQty,
    getCart
} from "../controllers/cart.controller.js";
import { protect } from "../middleware/auth.js";

router.get("/", protect, getCart);
router.post("/sync-cart", protect, syncCart);
router.post("/add-to-cart", protect, addToCart);
router.post("/qty", protect, updateQty);
router.post("/remove-from-cart", protect, removeFromCart);


export default router