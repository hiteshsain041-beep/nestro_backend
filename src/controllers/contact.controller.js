import ContactModel from "../models/contact.model.js";
import {
    sendBadRequest,
    sendNotFound,
    sendServerError,
    sendSuccess,
} from "../utils/response.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact   — public, no auth required
// ─────────────────────────────────────────────────────────────────────────────
export const create = async (req, res) => {
    try {
        const { name, email, phone = "", subject = "", message } = req.body;

        if (!name?.trim() || !email?.trim() || !message?.trim()) {
            return sendBadRequest(res, "Name, email and message are required");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sendBadRequest(res, "Please provide a valid email address");
        }

        const contact = await ContactModel.create({ name, email, phone, subject, message });

        return res.status(201).json({
            success: true,
            message: "Message received. We'll get back to you within 24 hours.",
            contact,
        });
    } catch (error) {
        console.error("[contact.create]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contact   — admin only
// ─────────────────────────────────────────────────────────────────────────────
export const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = "", isRead } = req.query;

        const filter = {};
        if (isRead !== undefined && isRead !== "") {
            filter.isRead = isRead === "true";
        }
        if (search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: "i" } },
                { email: { $regex: search.trim(), $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await ContactModel.countDocuments(filter);
        const unread = await ContactModel.countDocuments({ isRead: false });

        const messages = await ContactModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        return res.status(200).json({
            success: true,
            message: "Messages fetched",
            pagination: {
                total,
                unread,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
            messages,
        });
    } catch (error) {
        console.error("[contact.getAll]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contact/:id/read   — toggle isRead
// ─────────────────────────────────────────────────────────────────────────────
export const toggleRead = async (req, res) => {
    try {
        const contact = await ContactModel.findById(req.params.id);
        if (!contact) return sendNotFound(res, "Message not found");

        contact.isRead = !contact.isRead;
        await contact.save();

        return sendSuccess(
            res,
            contact.isRead ? "Marked as read" : "Marked as unread",
            { contact }
        );
    } catch (error) {
        console.error("[contact.toggleRead]", error.message);
        return sendServerError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contact/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteById = async (req, res) => {
    try {
        const contact = await ContactModel.findByIdAndDelete(req.params.id);
        if (!contact) return sendNotFound(res, "Message not found");
        return sendSuccess(res, "Message deleted successfully");
    } catch (error) {
        console.error("[contact.deleteById]", error.message);
        return sendServerError(res, error);
    }
};
