import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, default: "" },
        subject: { type: String, default: "" },
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const ContactModel = mongoose.model("Contact", contactSchema);
export default ContactModel;
