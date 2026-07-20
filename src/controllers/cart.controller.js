import mongoose from "mongoose";
import CartModel from "../models/cart.model.js";
import {
    sendBadRequest,
    sendSuccess,
    sendServerError,
    sendNotFound
} from "../utils/response.js";


const syncCart = async (req, res) => {
    try {

        const userId = req.user._id;

        const localCart = JSON.parse(req.body.localCart) || [];


        let userCart = await CartModel.findOne({ userId });


        // if cart not exist create
        if (!userCart) {

            userCart = new CartModel({
                userId,
                items: []
            });

        }



        // merge local cart
        localCart.forEach((cartItem) => {

            const { id, qty } = cartItem;


            const existingItem = userCart.items.find(
                item => item.productId.toString() === id
            );


            if (existingItem) {

                existingItem.qty += qty;

            }
            else {

                userCart.items.push({
                    productId: id,
                    qty
                });

            }


        });



        await userCart.save();



        // important: populate after save
        await userCart.populate({
            path: "items.productId",
            select: "name _id salePrice originalPrice discount thumbnail"
        });



        return res.status(200).json({

            message: "Cart synced successfully",

            success: true,

            cart: userCart

        });



    }
    catch (error) {

        // console.log(error);

        return sendServerError(res);

    }
};



const addToCart = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            productId,
            qty = 1
        } = req.body;

        if (!productId) {
            return sendBadRequest(
                res,
                "Product ID required"
            );
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                productId
            )
        ) {
            return sendBadRequest(
                res,
                "Invalid Product ID"
            );
        }

        let cart = await CartModel.findOne({
            userId
        });

        // Create cart
        if (!cart) {
            cart = await CartModel.create({
                userId,
                items: [
                    {
                        productId,
                        qty
                    }
                ]
            });

            await cart.populate(
                "items.productId",
                "_id name salePrice originalPrice discount thumbnail"
            );

            return sendSuccess(
                res,
                "Product added to cart",
                cart
            );
        }

        const existingItem = cart.items.find(
            item =>
                item.productId.toString() ===
                productId
        );

        if (existingItem) {
            existingItem.qty += Number(qty);
        } else {
            cart.items.push({
                productId,
                qty: Number(qty)
            });
        }

        await cart.save();

        await cart.populate(
            "items.productId",
            "_id name salePrice originalPrice discount thumbnail"
        );

        return sendSuccess(
            res,
            "Product added to cart",
            cart
        );
    } catch (error) {
        // console.log(error);
        return sendServerError(
            res,
            "Internal Server Error"
        );
    }
};


const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.body;

        if (!productId) {
            return sendBadRequest(
                res,
                "Product ID required"
            );
        }

        const cart = await CartModel.findOne({
            userId
        });

        if (!cart) {
            return sendNotFound(
                res,
                "Cart not found"
            );
        }

        cart.items = cart.items.filter(
            item =>
                item.productId.toString() !==
                productId
        );

        await cart.save();

        await cart.populate(
            "items.productId",
            "_id name salePrice originalPrice discount thumbnail"
        );

        return sendSuccess(
            res,
            "Product removed successfully",
            cart
        );
    } catch (error) {
        // console.log(error);

        return sendServerError(
            res,
            "Internal Server Error"
        );
    }
};


const updateQty = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            productId,
            action
        } = req.body;

        if (
            !["increase", "decrease"].includes(
                action
            )
        ) {
            return sendBadRequest(
                res,
                "Invalid action"
            );
        }

        const cart = await CartModel.findOne({
            userId
        });

        if (!cart) {
            return sendNotFound(
                res,
                "Cart not found"
            );
        }

        const item = cart.items.find(
            item =>
                item.productId.toString() ===
                productId
        );

        if (!item) {
            return sendNotFound(
                res,
                "Product not found in cart"
            );
        }

        if (action === "increase") {
            item.qty += 1;
        }

        if (action === "decrease") {
            item.qty -= 1;
        }

        // Remove item if qty <= 0
        if (item.qty <= 0) {
            cart.items = cart.items.filter(
                i =>
                    i.productId.toString() !==
                    productId
            );
        }

        await cart.save();

        await cart.populate(
            "items.productId",
            "_id name salePrice originalPrice discount thumbnail"
        );

        return sendSuccess(
            res,
            "Quantity updated successfully",
            cart
        );
    } catch (error) {
        // console.log(error);

        return sendServerError(
            res,
            "Internal Server Error"
        );
    }
};


const getCart = async (req, res) => {
    try {
        const userId = req.user._id;

        const cart = await CartModel.findOne({
            userId
        }).populate(
            "items.productId",
            "_id name salePrice originalPrice discount thumbnail"
        );

        if (!cart) {
            return sendSuccess(
                res,
                "Cart is empty",
                {
                    items: []
                }
            );
        }

        return sendSuccess(
            res,
            "Cart fetched successfully",
            cart
        );
    } catch (error) {
        // console.log(error);

        return sendServerError(
            res,
            "Internal Server Error"
        );
    }
};

export {
    syncCart,
    addToCart,
    removeFromCart,
    updateQty,
    getCart
};