import mongoose from "mongoose";


const productDetailsSchema = new mongoose.Schema({
    product_id: { type:mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
}, { _id: false });



const orderSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    items: {
        type: [productDetailsSchema],
        required: true
    },

    shippingAddress: {
        fullName: { type: String, required: true },
        mobile: { type: String, required: true },
        pincode: { type: String, required: true },
        addressLine: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, default: "India" }
    },

    paymentMethod: {
        type: String,
        enum: ["cod", "online"],
        required: true
    },

    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },

    orderStatus: {
        type: String,
        enum: [
            "placed",
            "confirmed",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "return"
        ],
        default: "placed"
    },

    totalAmount: {
        type: Number,
        required: true
    },
    razorpay_payment_id: {
        type: String,
        default: null
    },
    razorpay_order_id: {
        type: String,
        default: null
    },

    paidAt: Date,
    deliveredAt: Date,
}, {
    timestamps: true
});

const OrderModel = mongoose.model("Order", orderSchema);
export default OrderModel