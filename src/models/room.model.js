import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        minLength: 3,
        maxLength: 20,
        required: [true, "Category name is required"],
        unique: true

    },
    slug: {
        type: String,
        minLength: 3,
        maxLength: 20,
        required: [true, "Category slug is required"],
        unique: true

    },
    status: {
        type: Boolean,
        default: true
    }
},
    {
        timestamps: true
    }
)

const RoomModel = mongoose.model("rooms", roomSchema);
export default RoomModel