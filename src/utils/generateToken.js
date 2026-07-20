import jwt from "jsonwebtoken";

/**
 * Sign a JWT for the given user id.
 * Throws immediately if JWT_SECRET is not set — this surfaces the
 * misconfiguration at startup rather than silently issuing broken tokens.
 */
function generateToken(id) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            "[generateToken] JWT_SECRET is not set in .env. " +
            "Add JWT_SECRET=<your-secret> to backend/.env and restart the server."
        );
    }
    return jwt.sign({ id }, secret, { expiresIn: "30d" });
}

export default generateToken;
