const { successResponse } = require("../utils/response");
const categoryService = require("../services/categoryService");

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục
 * @access  Public
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const { includeInactive, language } = req.query;
    console.log("call", includeInactive, language);

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
