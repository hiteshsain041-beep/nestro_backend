import CartModel from "../models/cart.model.js";
import OrderModel from "../models/order.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
    sendBadRequest,
    sendSuccess,
    sendServerError,
    sendNotFound,
} from "../utils/response.js";

// ── Razorpay instance — created lazily so startup validation in app.js runs first
let _razorpay;
function getRazorpay() {
    if (!_razorpay) {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_id || !key_secret) {
            throw new Error(
                "[getRazorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in .env"
            );
        }
        _razorpay = new Razorpay({ key_id, key_secret });
    }
    return _razorpay;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order/place
// ─────────────────────────────────────────────────────────────────────────────
const place = async (req, res) => {
    try {
        const userId = req.user._id;
        const { shippingAddress, paymentMethod } = req.body;

        if (!shippingAddress || !paymentMethod) {
            return sendBadRequest(
                res,
                "Shipping address and payment method are required"
            );
        }

        const cart = await CartModel.findOne({ userId }).populate({
            path: "items.productId",
            select: "name _id salePrice originalPrice discount thumbnail",
        });

        if (!cart) return sendNotFound(res, "Cart not found");
        if (!cart.items.length) return sendBadRequest(res, "Cart is empty");

        // ── Build order items, guarding against deleted products ──────────────
        const items = [];
        for (const item of cart.items) {
            const product = item.productId; // populated above

            // Product was deleted from the catalogue since it was added to cart
            if (!product || !product._id) {
                // Remove the dead entry silently and continue
                continue;
            }

            const price = product.salePrice || product.originalPrice;
            if (!price) {
                continue; // skip zero-price entries
            }

            items.push({
                product_id: product._id,
                qty: item.qty,
                price,
                total: price * item.qty,
            });
        }

        if (items.length === 0) {
            return sendBadRequest(
                res,
                "Your cart contains no valid products. Please add items and try again."
            );
        }

        const totalAmount = items.reduce((sum, i) => sum + i.total, 0);

        const order = await OrderModel.create({
            user: userId,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod,
            paymentStatus: "pending",
        });

        // ── COD: clear cart and confirm immediately ───────────────────────────
        if (paymentMethod === "cod") {
            await CartModel.findOneAndUpdate(
                { userId },
                { $set: { items: [] } },
                { returnDocument: "after" }
            );
            return res.status(201).json({
                success: true,
                message: "Order placed successfully",
                orderId: order._id,
            });
        }

        // ── Online: create Razorpay order ─────────────────────────────────────
        const receipt = order._id.toString().slice(-40); // ObjectId = 24 chars, safe

        const rzpOrder = await getRazorpay().orders.create({
            amount: Math.round(totalAmount * 100), // paise, must be integer
            currency: "INR",
            receipt,
        });

        order.razorpay_order_id = rzpOrder.id;
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Razorpay order created",
            orderId: order._id,
            razorpay_order_id: rzpOrder.id,
            total: Math.round(totalAmount * 100),
        });
    } catch (error) {
        console.error("[order.place]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order/verify
// ─────────────────────────────────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
            req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return sendBadRequest(res, "Missing payment verification fields");
        }

        const order = await OrderModel.findOne({ razorpay_order_id });
        if (!order) return sendNotFound(res, "Order not found");

        // HMAC-SHA256 signature verification
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid payment signature" });
        }

        order.razorpay_payment_id = razorpay_payment_id;
        order.paymentStatus = "paid";
        order.paidAt = new Date();
        await order.save();

        // Clear the user's cart after successful payment
        await CartModel.findOneAndUpdate(
            { userId: order.user },
            { $set: { items: [] } },
            { returnDocument: "after" }
        );

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            orderId: order._id,
        });
    } catch (error) {
        console.error("[order.verifyPayment]", error.message, error.stack);
        return res
            .status(500)
            .json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/order/my-orders  (authenticated user — own orders)
// ─────────────────────────────────────────────────────────────────────────────
const myOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        const orders = await OrderModel.find({ user: userId })
            .populate("items.product_id", "name thumbnail salePrice originalPrice")
            .sort({ createdAt: -1 }); // newest first

        return res.status(200).json({
            success: true,
            message: "Orders fetched",
            orders,
        });
    } catch (error) {
        console.error("[order.myOrders]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/order  (admin)
// ─────────────────────────────────────────────────────────────────────────────
const read = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status,
            paymentStatus,
            startDate,
            endDate,
            minAmount,
            maxAmount,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const query = {};
        if (status) query.orderStatus = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) query.totalAmount.$gte = Number(minAmount);
            if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                {
                    "shippingAddress.fullName": { $regex: search, $options: "i" },
                },
                {
                    "shippingAddress.mobile": { $regex: search, $options: "i" },
                },
            ];
        }

        const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
        const skip = (Number(page) - 1) * Number(limit);

        const [orders, totalOrders] = await Promise.all([
            OrderModel.find(query)
                .populate("user", "-password -otp -otpExpire -__v")
                .sort(sort)
                .skip(skip)
                .limit(Number(limit)),
            OrderModel.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            message: "Orders fetched",
            pagination: {
                total: totalOrders,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(totalOrders / Number(limit)),
            },
            orders,
        });
    } catch (error) {
        console.error("[order.read]", error.message, error.stack);
        return sendServerError(res, error);
    }
};

export { place, read, verifyPayment, myOrders };
