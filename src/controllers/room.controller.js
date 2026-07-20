import RoomModel from "../models/room.model.js";
import {
  sendConflict,
  sendCreated,
  sendNotFound,
  sendServerError,
  sendSuccess,
} from "../utils/response.js";

const get = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status !== undefined) {
      filter.status = req.query.status === "true";
    }

    const rooms = await RoomModel.find(filter);

    return res.status(200).json({
      success: true,
      message: "Data found",
      rooms,
    });
  } catch (error) {
    // console.error("GET Rooms Error:", error);
    return sendServerError(res, error.message);
  }
};

const getById = async (req, res) => {
  try {
    const room = await RoomModel.findById(req.params.id);

    if (!room) {
      return sendNotFound(res, "Room Type not found");
    }

    return res.status(200).json({
      success: true,
      message: "Data found",
      room,
    });
  } catch (error) {
    // console.error("GET Room Error:", error);
    return sendServerError(res, error.message);
  }
};

const create = async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and Slug are required",
      });
    }

    const exists = await RoomModel.findOne({ name });

    if (exists) {
      return sendConflict(res, "Room Type already exists");
    }

    await RoomModel.create({
      name,
      slug,
    });

    return sendCreated(res, "Room Type created successfully");
  } catch (error) {
    // console.error("CREATE Room Error:", error);
    return sendServerError(res, error.message);
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    const room = await RoomModel.findById(id);

    if (!room) {
      return sendNotFound(res, "Room Type not found");
    }

    const duplicate = await RoomModel.findOne({
      name,
      _id: { $ne: id },
    });

    if (duplicate) {
      return sendConflict(res, "Room Type already exists");
    }

    await RoomModel.findByIdAndUpdate(
      id,
      { name, slug },
      { returnDocument: "after" }
    );

    return sendSuccess(res, "Room Type updated successfully");
  } catch (error) {
    // console.error("UPDATE Room Error:", error);
    return sendServerError(res, error.message);
  }
};

const deleteById = async (req, res) => {
  try {
    const room = await RoomModel.findById(req.params.id);

    if (!room) {
      return sendNotFound(res, "Room Type not found");
    }

    await RoomModel.findByIdAndDelete(req.params.id);

    return sendSuccess(res, "Room Type deleted successfully");
  } catch (error) {
    // console.error("DELETE Room Error:", error);
    return sendServerError(res, error.message);
  }
};

const StatusUpdate = async (req, res) => {
  try {
    const room = await RoomModel.findById(req.params.id);

    if (!room) {
      return sendNotFound(res, "Room Type not found");
    }

    await RoomModel.findByIdAndUpdate(req.params.id, {
      status: !room.status,
    });

    return sendSuccess(res, "Status updated successfully");
  } catch (error) {
    // console.error("STATUS UPDATE Error:", error);
    return sendServerError(res, error.message);
  }
};

export {
  get,
  getById,
  create,
  update,
  deleteById,
  StatusUpdate,
};