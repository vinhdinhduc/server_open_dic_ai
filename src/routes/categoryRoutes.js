const express = require("express");
const { body } = require("express-validator");
const categoryController = require("../controllers/categoryController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { validate, validateObjectId } = require("../middlewares/validate");

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
  [
    body("name.vi")
      .trim()
      .notEmpty()
      .withMessage("Tên danh mục tiếng Việt là bắt buộc"),
    body("slug")
      .trim()
      .notEmpty()
      .withMessage("Slug là bắt buộc")
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug chỉ được chứa chữ thường, số và dấu gạch ngang"),
    body("parentCategory")
      .optional()
      .isMongoId()
      .withMessage("ID danh mục cha không hợp lệ"),
    body("order")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Thứ tự phải là số nguyên dương"),
    validate,
  ],
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
  [
    body("name.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Tên danh mục không được để trống"),
    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug chỉ được chứa chữ thường, số và dấu gạch ngang"),
    validate,
  ],
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
