import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        items: [
            {
                _id: false,

                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },

                qty: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1
                }
            }
        ]
    },
    {
        timestamps: true
    }
);


const CartModel = mongoose.model(
    "Cart",
    cartSchema
);

export default CartModel;