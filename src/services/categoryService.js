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
    name: category.name[language] || category.name["vi"],
    slug: category.slug,
    description: category.description[language] || category.description["vi"],
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
exports.deleteCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra có thuật ngữ nào không
  if (category.termCount > 0) {
    const error = new Error("Không thể xóa danh mục đang có thuật ngữ");
    error.statusCode = 400;
    throw error;
  }

  // Kiểm tra có danh mục con không
  const childCategories = await Category.countDocuments({
    parentCategory: categoryId,
  });
  if (childCategories > 0) {
    const error = new Error("Không thể xóa danh mục đang có danh mục con");
    error.statusCode = 400;
    throw error;
  }

  await category.deleteOne();

  return { message: "Xóa danh mục thành công" };
};
