import AddressModel from "../models/address.model.js";
import {
    sendSuccess,
    sendCreated,
    sendBadRequest,
    sendNotFound,
    sendServerError
} from "../utils/response.js";

// ─────────────────────────────────────────
// POST /api/address/create
// Create a new address for the logged-in user
// ─────────────────────────────────────────
const create = async (req, res) => {
    try {
        const { fullName, mobile, state, district, city, pincode, address } = req.body;

        // Validate all required fields
        if (!fullName || !mobile || !state || !district || !city || !pincode || !address) {
            return sendBadRequest(res, "All fields are required");
        }

        // Mobile: must be 10 digits
        if (!/^\d{10}$/.test(mobile)) {
            return sendBadRequest(res, "Enter a valid 10-digit mobile number");
        }

        // Pincode: must be 6 digits
        if (!/^\d{6}$/.test(pincode)) {
            return sendBadRequest(res, "Enter a valid 6-digit pincode");
        }

        const newAddress = await AddressModel.create({
            userId: req.user._id,
            fullName,
            mobile,
            state,
            district,
            city,
            pincode,
            address
        });

        return res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: newAddress
        });

    } catch (error) {
        // console.log(error);
        return sendServerError(res, "Internal Server Error");
    }
};

// ─────────────────────────────────────────
// GET /api/address
// Get all addresses of the logged-in user
// ─────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const addresses = await AddressModel
            .find({ userId: req.user._id })
            .sort({ createdAt: -1 }); // Newest first

        return sendSuccess(res, "Addresses fetched", addresses);

    } catch (error) {
        // console.log(error);
        return sendServerError(res, "Internal Server Error");
    }
};

// ─────────────────────────────────────────
// PUT /api/address/update/:id
// Update an address (only owner can update)
// ─────────────────────────────────────────
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, mobile, state, district, city, pincode, address } = req.body;

        // Validate all required fields
        if (!fullName || !mobile || !state || !district || !city || !pincode || !address) {
            return sendBadRequest(res, "All fields are required");
        }

        // Mobile validation
        if (!/^\d{10}$/.test(mobile)) {
            return sendBadRequest(res, "Enter a valid 10-digit mobile number");
        }

        // Pincode validation
        if (!/^\d{6}$/.test(pincode)) {
            return sendBadRequest(res, "Enter a valid 6-digit pincode");
        }

        // Find address and ensure it belongs to this user
        const existing = await AddressModel.findOne({ _id: id, userId: req.user._id });

        if (!existing) {
            return sendNotFound(res, "Address not found");
        }

        const updated = await AddressModel.findByIdAndUpdate(
            id,
            { fullName, mobile, state, district, city, pincode, address },
            { returnDocument: "after" }
        );

        return res.status(200).json({
            success: true,
            message: "Address updated successfully",
            address: updated
        });

    } catch (error) {
        // console.log(error);
        return sendServerError(res, "Internal Server Error");
    }
};

// ─────────────────────────────────────────
// DELETE /api/address/delete/:id
// Delete an address (only owner can delete)
// ─────────────────────────────────────────
const deleteById = async (req, res) => {
    try {
        const { id } = req.params;

        // Ensure the address belongs to this user before deleting
        const existing = await AddressModel.findOne({ _id: id, userId: req.user._id });

        if (!existing) {
            return sendNotFound(res, "Address not found");
        }

        await AddressModel.findByIdAndDelete(id);

        return sendSuccess(res, "Address deleted successfully");

    } catch (error) {
        // console.log(error);
        return sendServerError(res, "Internal Server Error");
    }
};

export { create, getAll, update, deleteById };
