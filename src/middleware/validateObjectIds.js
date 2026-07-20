import mongoose from "mongoose";
import { sendBadRequest } from "../utils/response.js";

/**
 * validateObjectIds(...fields)
 *
 * Express middleware factory that checks one or more req.body fields
 * are valid, non-empty MongoDB ObjectIds.
 *
 * Usage:
 *   router.post("/create", protect, validateObjectIds("roomId","categoryId"), create);
 */
export function validateObjectIds(...fields) {
    return (req, res, next) => {
        for (const field of fields) {
            const value = req.body[field];

            // Missing, null, undefined, or empty string
            if (!value || String(value).trim() === "") {
                return sendBadRequest(res, `${field} is required`);
            }

            // Invalid ObjectId format
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return sendBadRequest(res, `${field} is not a valid ID`);
            }
        }
        next();
    };
}
