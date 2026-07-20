import express from "express";
const router = express.Router();
import { place, read, verifyPayment, myOrders } from "../controllers/order.controller.js";
import { protect } from "../middleware/auth.js";

router.post("/place", protect, place);
router.get("/my-orders", protect, myOrders);
router.get("/", protect, read);
router.post("/verify", protect, verifyPayment);

export default router;
