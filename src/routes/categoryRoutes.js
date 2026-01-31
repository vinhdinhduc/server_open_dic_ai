const express = require("express");
const categoryController = require("../controllers/categoryController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { validate, validateObjectId } = require("../middlewares/validate");
const { categoryValidators } = require("../validators");

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục
 * @access  Public
 */
router.get("/", categoryController.getAllCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Lấy chi tiết danh mục
 * @access  Public
 */
router.get("/:id", validateObjectId("id"), categoryController.getCategoryById);

/**
 * @route   POST /api/categories
 * @desc    Tạo danh mục mới
 * @access  Private - Admin
 */
router.post(
  "/",
  authenticate,
  isAdmin,
  categoryValidators.create,
  validate,
  categoryController.createCategory,
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Cập nhật danh mục
 * @access  Private - Admin
 */
router.put(
  "/:id",
  authenticate,
  isAdmin,
  validateObjectId("id"),
  categoryValidators.update,
  validate,
  categoryController.updateCategory,
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Xóa danh mục
 * @access  Private - Admin
 */
router.delete(
  "/:id",
  authenticate,
  isAdmin,
  validateObjectId("id"),
  categoryController.deleteCategory,
);

module.exports = router;
