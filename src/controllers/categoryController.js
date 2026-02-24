const { successResponse } = require("../utils/response");
const categoryService = require("../services/categoryService");
const Category = require("../models/Category");
const Contribution = require("../models/Contribution");
const Term = require("../models/Term");
const Report = require("../models/Report");

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục
 * @access  Public
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const { includeInactive, language } = req.query;

    const categories = await categoryService.getAllCategories({
      includeInactive: includeInactive === "true",
      language: language || "vi",
    });

    return successResponse(
      res,
      "Lấy danh sách danh mục thành công",
      categories,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/categories/:id
 * @desc    Lấy chi tiết danh mục
 * @access  Public
 */
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await categoryService.getCategoryById(id);

    return successResponse(res, "Lấy thông tin danh mục thành công", category);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/categories
 * @desc    Tạo danh mục mới
 * @access  Private - Admin
 */
exports.createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;

    const category = await categoryService.createCategory(categoryData);

    return successResponse(res, "Tạo danh mục thành công", category, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/categories/:id
 * @desc    Cập nhật danh mục
 * @access  Private - Admin
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await categoryService.updateCategory(id, updateData);

    return successResponse(res, "Cập nhật danh mục thành công", category);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/categories/:id
 * @desc    Xóa danh mục
 * @access  Private - Admin
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await categoryService.deleteCategory(id);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/categories/:id/deactivate
 * @desc    Vô hiệu hóa (ẩn) danh mục thay vì xóa
 * @access  Private - Admin
 */
exports.deactivateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await categoryService.deactivateCategory(id);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/categories/moderator/my-categories
 * @desc    Lấy danh mục được phân quyền cho moderator kèm stats
 * @access  Private - Moderator/Admin
 */
exports.getModeratorCategories = async (req, res, next) => {
  try {
    const user = req.user;
    let categoryIds;

    if (user.role === "admin") {
      // Admin thấy tất cả
      const allCategories = await Category.find({}).lean();
      categoryIds = allCategories.map((c) => c._id);
    } else {
      // Moderator chỉ thấy danh mục được gán
      categoryIds = user.moderationPermissions?.categories || [];
    }

    if (categoryIds.length === 0) {
      return successResponse(res, "Bạn chưa được phân quyền danh mục nào", []);
    }

    // Lấy categories kèm thống kê
    const categories = await Category.find({
      _id: { $in: categoryIds },
    }).lean();

    // Lấy thống kê cho từng danh mục
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const [termCount, pendingContributions, pendingReports] =
          await Promise.all([
            Term.countDocuments({ category: category._id, status: "approved" }),
            Contribution.countDocuments({
              category: category._id,
              status: "pending",
            }),
            Report.countDocuments({
              category: category._id,
              status: "pending",
            }).catch(() => 0),
          ]);

        return {
          ...category,
          stats: {
            termCount,
            pendingContributions,
            pendingReports,
            totalPending: pendingContributions + pendingReports,
          },
        };
      }),
    );

    return successResponse(
      res,
      "Lấy danh mục phụ trách thành công",
      categoriesWithStats,
    );
  } catch (error) {
    next(error);
  }
};
