const Category = require("../models/Category");

//Get all categories

exports.getAllCategories = async (options = {}) => {
  const { includeInactive = false, language = "vi" } = options;
  const query = {};
  if (!includeInactive) {
    query.isActive = true;
  }

  const categories = await Category.find(query)
    .sort({ order: 1, "name.vi": 1 })
    .populate("moderators", "fullName email")
    .lean();
  //format categories based on language
  return categories.map((category) => ({
    id: category._id,
    name: category.name?.[language] || category.name?.["vi"] || "",
    slug: category.slug,
    description:
      category.description?.[language] || category.description?.["vi"] || "",
    isActive: category.isActive,
    icon: category.icon,
    parentCategory: category.parentCategory,
    order: category.order,
    termCount: category.termCount,
  }));
};
/**
 * Lấy chi tiết danh mục
 */
exports.getCategoryById = async (categoryId) => {
  const category = await Category.findById(categoryId)
    .populate("parentCategory", "name slug")
    .populate("moderators", "fullName email role");

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  return category;
};

/**
 * Tạo danh mục mới
 */
exports.createCategory = async (categoryData) => {
  // Kiểm tra slug trùng lặp
  const existingCategory = await Category.findOne({ slug: categoryData.slug });
  if (existingCategory) {
    const error = new Error("Slug đã tồn tại");
    error.statusCode = 400;
    throw error;
  }

  // Kiểm tra parent category nếu có
  if (categoryData.parentCategory) {
    const parent = await Category.findById(categoryData.parentCategory);
    if (!parent) {
      const error = new Error("Danh mục cha không tồn tại");
      error.statusCode = 404;
      throw error;
    }
  }

  const category = await Category.create(categoryData);
  return category;
};

/**
 * Cập nhật danh mục
 */
exports.updateCategory = async (categoryId, updateData) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra slug trùng lặp nếu có thay đổi
  if (updateData.slug && updateData.slug !== category.slug) {
    const existingCategory = await Category.findOne({ slug: updateData.slug });
    if (existingCategory) {
      const error = new Error("Slug đã tồn tại");
      error.statusCode = 400;
      throw error;
    }
  }

  Object.assign(category, updateData);
  await category.save();

  return category;
};

/**
 * Xóa danh mục
 */
exports.deleteCategory = async (categoryId, options = {}) => {
  const Term = require("../models/Term");
  const category = await Category.findById(categoryId);

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra có danh mục con không (luôn chặn)
  const childCount = await Category.countDocuments({
    parentCategory: categoryId,
  });
  if (childCount > 0) {
    const error = new Error(
      `Không thể xóa danh mục đang có ${childCount} danh mục con. Vui lòng xóa hoặc chuyển danh mục con trước.`,
    );
    error.statusCode = 400;
    error.childCount = childCount;
    throw error;
  }

  // Kiểm tra có thuật ngữ nào không (đếm trực tiếp từ DB, tránh dùng termCount cached)
  const actualTermCount = await Term.countDocuments({ category: categoryId });
  if (actualTermCount > 0) {
    const error = new Error(
      `Không thể xóa danh mục đang có ${actualTermCount} thuật ngữ. Hãy xóa hết thuật ngữ hoặc chuyển chúng sang danh mục khác, hoặc chọn "Ẩn danh mục" thay vì xóa.`,
    );
    error.statusCode = 400;
    error.termCount = actualTermCount;
    throw error;
  }

  await category.deleteOne();

  return { message: "Xóa danh mục thành công" };
};

/**
 * Vô hiệu hóa (ẩn) danh mục - soft delete
 */
exports.deactivateCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  category.isActive = false;
  await category.save();

  return { message: "Đã ẩn danh mục thành công" };
};

/**
 * Vô hiệu hóa (ẩn) danh mục thay vì xóa
 */
exports.deactivateCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  category.isActive = false;
  await category.save();

  return { message: "Đã ẩn danh mục thành công" };
};
