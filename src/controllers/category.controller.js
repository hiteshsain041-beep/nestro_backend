import CategoryModel from "../models/category.model.js";
import { sendBadRequest, sendConflict, sendCreated, sendNotFound, sendServerError, sendSuccess } from "../utils/response.js"

const get = async (req, res) => {
    try {
        const query = req.query;
        const filter = {};
        const limit = query.limit ? parseInt(query.limit) : 0;
        if (query.status) filter.status = query.status === "true";

        const categories = await CategoryModel.find(filter).limit(limit);
        return res.status(200).json({
            success: true,
            message: "Data find",
            categories
        })

    } catch (error) {
        sendServerError(res, "Internal Server Error")
    }

}

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await CategoryModel.findById(id)
        return res.status(200).json({
            success: true,
            message: "Data find",
            category: category
        })

    } catch (error) {
        sendServerError(res, "Internal Server Error")
    }

}


const create = async (req, res) => {
    try {

        const { name, slug } = req.body;

        if (!name || !slug) return sendBadRequest(res, "Name and slug are required");

        // Cloudinary Image URL
        const image = req.file?.path || "";

        const category = await CategoryModel.findOne({ name });
        if (category) return sendConflict(res);
        await CategoryModel.create({ name, slug, image });
        sendCreated(res);

    } catch (error) {
        console.error("[category.create]", error.message, error.stack);
        sendServerError(res, error)
    }

}

const update = async (req, res) => {

    try {

        const { id } = req.params;

        const { name, slug, roomId } = req.body;

        // =========================
        // Check Category Exists
        // =========================
        const oldCategory = await CategoryModel.findById(id);

        if (!oldCategory) {
            return sendNotFound(res, "Category not found");
        }

        // =========================
        // Duplicate Name Check
        // =========================
        const categoryExists = await CategoryModel.findOne({ name, _id: { $ne: id } });

        if (categoryExists) {
            return sendConflict(res, "Category already exists");
        }

        // =========================
        // Update Object
        // =========================
        const updateData = {
            name,
            slug,
            roomId
        };

        // =========================
        // If New Image Uploaded
        // =========================
        if (req.file) {
            // Cloudinary URL
            updateData.image = req.file.path;
        }
        // =========================
        // Update Category
        // =========================
        await CategoryModel.findByIdAndUpdate(
            id,
            updateData,
            { returnDocument: "after" }
        );

        return sendSuccess(
            res,
            "Category updated successfully"
        );


    }
    catch (error) {

        console.error("[category.update]", error.message, error.stack);

        return sendServerError(
            res,
            error
        );
    }
};


const deleteById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await CategoryModel.findById({ _id: id });
        if (!category) return sendNotFound(res);
        await CategoryModel.findByIdAndDelete(id)

        sendSuccess(res, "Delete Sucessfully")

    } catch (error) {
        sendServerError(res, "Internal Server Error")
    }

}

const StatusUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await CategoryModel.findById({ _id: id });
        if (!category) return sendNotFound(res);
        await CategoryModel.findByIdAndUpdate(
            { _id: id },
            {
                $set: {
                    status: !category.status
                }
            }

        )

        sendSuccess(res, "Data Update Sucessfully")

    } catch (error) {
        sendServerError(res, "Internal Server Error")
    }

}

export {
    get,
    create,
    StatusUpdate,

    deleteById,
    getById,
    update
}