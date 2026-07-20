import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        // Each address belongs to a logged-in user
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true
        },
        mobile: {
            type: String,
            required: [true, "Mobile number is required"],
            trim: true
        },
        state: {
            type: String,
            required: [true, "State is required"],
            trim: true
        },
        district: {
            type: String,
            required: [true, "District is required"],
            trim: true
        },
        city: {
            type: String,
            required: [true, "City is required"],
            trim: true
        },
        pincode: {
            type: String,
            required: [true, "Pincode is required"],
            trim: true
        },
        address: {
            type: String,
            required: [true, "Address is required"],
            trim: true
        }
    },
    { timestamps: true }
);

const AddressModel = mongoose.model("Address", addressSchema);
export default AddressModel;
