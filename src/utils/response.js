// 200 — success
const sendSuccess = (res, message = "Success", data = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(200).json(payload);
};

// 201 — resource created
const sendCreated = (res, message = "Created successfully") => {
  return res.status(201).json({ success: true, message });
};

// 400 — bad request / validation error
const sendBadRequest = (res, message = "Bad request") => {
  return res.status(400).json({ success: false, message });
};

// 401 — authentication failed (wrong password, invalid credentials)
const sendUnauthorized = (res, message = "Unauthorized") => {
  return res.status(401).json({ success: false, message });
};

// 404 — resource not found
const sendNotFound = (res, message = "Resource not found") => {
  return res.status(404).json({ success: false, message });
};

// 409 — conflict (duplicate resource — e.g. email already registered)
const sendConflict = (res, message = "Data already exists") => {
  return res.status(409).json({ success: false, message });
};

// 500 — internal server error
// Logs the real error to the terminal; sends a safe generic message to the client.
const sendServerError = (res, error) => {
  if (error instanceof Error) {
    console.error("[SERVER ERROR]", error.message);
    console.error(error.stack);
  } else if (error) {
    console.error("[SERVER ERROR]", error);
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
};

export {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,   // ← new, correct 401
  sendNotFound,
  sendConflict,
  sendServerError,
};
