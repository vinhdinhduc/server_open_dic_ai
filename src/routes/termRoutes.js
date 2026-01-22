const express = require("express");
const { body } = require("express-validator");
const termController = require("../controllers/termController");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { isModerator } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

const router = express.Router();

/**
 * @route   GET /api/terms/search
 * @desc    Tìm kiếm thuật ngữ
 * @access  Public
 */
router.get(
  "/search",
  optionalAuth,
  validatePagination,
  termController.searchTerms,
);

/**
 * @route   GET /api/terms/suggestions
 * @desc    Gợi ý thuật ngữ (autocomplete)
 * @access  Public
 */
router.get("/suggestions", termController.getSuggestions);

/**
 * @route   GET /api/terms/:id
 * @desc    Lấy chi tiết thuật ngữ
 * @access  Public
 */
router.get(
  "/:id",
  validateObjectId("id"),
  optionalAuth,
  termController.getTermById,
);

/**
 * @route   GET /api/terms
 * @desc    Lấy danh sách thuật ngữ
 * @access  Public
 */
router.get("/", validatePagination, termController.getTerms);

/**
 * @route   POST /api/terms
 * @desc    Tạo thuật ngữ mới
 * @access  Private - Moderator/Admin
 */
router.post(
  "/",
  authenticate,
  isModerator,
  [
    body("term.vi")
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt là bắt buộc"),
    body("definition.vi")
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt là bắt buộc"),
    body("category")
      .notEmpty()
      .withMessage("Danh mục là bắt buộc")
      .isMongoId()
      .withMessage("ID danh mục không hợp lệ"),
    validate,
  ],
  termController.createTerm,
);

/**
 * @route   PUT /api/terms/:id
 * @desc    Cập nhật thuật ngữ
 * @access  Private - Moderator/Admin
 */
router.put(
  "/:id",
  authenticate,
  isModerator,
  validateObjectId("id"),
  [
    body("term.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt không được để trống"),
    body("definition.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt không được để trống"),
    validate,
  ],
  termController.updateTerm,
);

/**
 * @route   DELETE /api/terms/:id
 * @desc    Xóa thuật ngữ
 * @access  Private - Admin
 */
router.delete(
  "/:id",
  authenticate,
  isModerator,
  validateObjectId("id"),
  termController.deleteTerm,
);

module.exports = router;
