import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import CategoryModel from "../models/category.model.js";
import UserModel from "../models/user.model.js";
import ContactModel from "../models/contact.model.js";
import { sendServerError, sendSuccess } from "../utils/response.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get the first day of the current month and the previous month
// ─────────────────────────────────────────────────────────────────────────────
function getMonthBounds() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { thisMonthStart, prevMonthStart, prevMonthEnd, now };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calculate % change safely
// ─────────────────────────────────────────────────────────────────────────────
function pctChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboard = async (req, res) => {
    try {
        const { thisMonthStart, prevMonthStart, prevMonthEnd, now } = getMonthBounds();

        // ── Run all independent queries in parallel ────────────────────────────
        const [
            totalOrders,
            totalProducts,
            totalCategories,
            totalCustomers,
            pendingOrders,
            totalMessages,

            // This-month counts
            thisMonthOrders,
            thisMonthCustomers,
            thisMonthProducts,
            thisMonthCategories,

            // Prev-month counts
            prevMonthOrders,
            prevMonthCustomers,

            // Revenue
            revenueAgg,
            prevRevenueAgg,
            thisMonthRevenueAgg,

            // Sections
            recentOrders,
            latestCustomers,
            lowStockProducts,
            contactMessages,

            // Order status summary
            orderStatusAgg,

            // Sales chart (last 12 months)
            salesChartAgg,

            // Weekly orders (last 7 days)
            weeklyOrdersAgg,

            // Top selling products
            topSellingAgg,

            // Activity timeline (recent orders + new customers)
            recentActivityOrders,
            recentActivityCustomers,
            recentActivityProducts,
        ] = await Promise.all([
            // Total counts
            OrderModel.countDocuments(),
            ProductModel.countDocuments(),
            CategoryModel.countDocuments(),
            UserModel.countDocuments({ role: "user" }),
            OrderModel.countDocuments({ orderStatus: "placed" }),
            ContactModel.countDocuments(),

            // This month
            OrderModel.countDocuments({ createdAt: { $gte: thisMonthStart } }),
            UserModel.countDocuments({ role: "user", createdAt: { $gte: thisMonthStart } }),
            ProductModel.countDocuments({ createdAt: { $gte: thisMonthStart } }),
            CategoryModel.countDocuments({ createdAt: { $gte: thisMonthStart } }),

            // Prev month
            OrderModel.countDocuments({ createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
            UserModel.countDocuments({ role: "user", createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),

            // Total revenue (delivered + paid)
            OrderModel.aggregate([
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
            // Prev month revenue
            OrderModel.aggregate([
                { $match: { paymentStatus: "paid", createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
            // This month revenue
            OrderModel.aggregate([
                { $match: { paymentStatus: "paid", createdAt: { $gte: thisMonthStart } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),

            // Recent orders (latest 10)
            OrderModel.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("user", "name email mobile image")
                .populate("items.product_id", "name thumbnail salePrice"),

            // Latest customers (last 8)
            UserModel.find({ role: "user" })
                .sort({ createdAt: -1 })
                .limit(8)
                .select("name email mobile image createdAt"),

            // Low stock products (stock = false, status = true)
            ProductModel.find({ stock: false, status: true })
                .limit(10)
                .populate("categoryId", "name")
                .select("name thumbnail stock categoryId"),

            // Contact messages (latest 8)
            ContactModel.find()
                .sort({ createdAt: -1 })
                .limit(8)
                .select("name email subject message isRead createdAt"),

            // Order status summary
            OrderModel.aggregate([
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
            ]),

            // Monthly sales + revenue (last 12 months)
            OrderModel.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                        },
                        orders: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
                            },
                        },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
            ]),

            // Weekly orders (last 7 days)
            OrderModel.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                        },
                        orders: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
                            },
                        },
                    },
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            ]),

            // Top selling products (by qty sold in delivered orders)
            OrderModel.aggregate([
                { $match: { orderStatus: "delivered" } },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.product_id",
                        soldQty: { $sum: "$items.qty" },
                        revenue: { $sum: "$items.total" },
                    },
                },
                { $sort: { soldQty: -1 } },
                { $limit: 8 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "product",
                    },
                },
                { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: "categories",
                        localField: "product.categoryId",
                        foreignField: "_id",
                        as: "category",
                    },
                },
                { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        soldQty: 1,
                        revenue: 1,
                        name: "$product.name",
                        thumbnail: "$product.thumbnail",
                        category: "$category.name",
                    },
                },
            ]),

            // Activity: last 5 orders placed
            OrderModel.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select("shippingAddress.fullName orderStatus createdAt totalAmount"),

            // Activity: last 3 new customers
            UserModel.find({ role: "user" })
                .sort({ createdAt: -1 })
                .limit(3)
                .select("name email createdAt"),

            // Activity: last 3 new products
            ProductModel.find()
                .sort({ createdAt: -1 })
                .limit(3)
                .select("name createdAt"),
        ]);

        // ── Derived stats ──────────────────────────────────────────────────────
        const totalRevenue = revenueAgg[0]?.total ?? 0;
        const prevRevenue = prevRevenueAgg[0]?.total ?? 0;
        const thisMonthRevenue = thisMonthRevenueAgg[0]?.total ?? 0;

        const stats = {
            totalOrders,
            totalProducts,
            totalCategories,
            totalCustomers,
            totalRevenue,
            pendingOrders,
            totalMessages,
            // month-over-month growth %
            ordersGrowth: pctChange(thisMonthOrders, prevMonthOrders),
            customersGrowth: pctChange(thisMonthCustomers, prevMonthCustomers),
            revenueGrowth: pctChange(thisMonthRevenue, prevRevenue),
            productsGrowth: pctChange(thisMonthProducts, 0),
            categoriesGrowth: pctChange(thisMonthCategories, 0),
            pendingGrowth: 0,
        };

        // ── Order status summary ───────────────────────────────────────────────
        const defaultStatuses = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled", "return"];
        const orderStatusSummary = {};
        defaultStatuses.forEach((s) => (orderStatusSummary[s] = 0));
        orderStatusAgg.forEach((item) => {
            if (item._id) orderStatusSummary[item._id] = item.count;
        });

        // ── Sales + Revenue charts ─────────────────────────────────────────────
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const salesChart = salesChartAgg.map((item) => ({
            month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
            orders: item.orders,
            revenue: item.revenue,
        }));

        const revenueChart = salesChart; // same data, different keys used on frontend

        // ── Weekly orders ──────────────────────────────────────────────────────
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const weeklyOrders = weeklyOrdersAgg.map((item) => {
            const date = new Date(item._id.year, item._id.month - 1, item._id.day);
            return {
                day: dayNames[date.getDay()],
                date: `${item._id.day} ${monthNames[item._id.month - 1]}`,
                orders: item.orders,
                revenue: item.revenue,
            };
        });

        // ── Activity timeline ──────────────────────────────────────────────────
        const activityTimeline = [
            ...recentActivityOrders.map((o) => ({
                type: "order",
                title: "New Order Placed",
                description: `Order by ${o.shippingAddress?.fullName ?? "Customer"} — ₹${o.totalAmount?.toLocaleString("en-IN")}`,
                status: o.orderStatus,
                createdAt: o.createdAt,
            })),
            ...recentActivityCustomers.map((u) => ({
                type: "customer",
                title: "New Customer Registered",
                description: `${u.name} joined (${u.email})`,
                createdAt: u.createdAt,
            })),
            ...recentActivityProducts.map((p) => ({
                type: "product",
                title: "Product Added",
                description: `New product: ${p.name}`,
                createdAt: p.createdAt,
            })),
        ]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);

        return res.status(200).json({
            success: true,
            stats,
            recentOrders,
            latestCustomers,
            topSellingProducts: topSellingAgg,
            lowStockProducts,
            contactMessages,
            recentReviews: [], // placeholder — no review model yet
            activityTimeline,
            salesChart,
            revenueChart,
            weeklyOrders,
            orderStatusSummary,
        });
    } catch (error) {
        console.error("[dashboard.getDashboard]", error.message, error.stack);
        return sendServerError(res, error);
    }
};
