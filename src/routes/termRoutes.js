const express = require("express");
const termController = require("../controllers/termController");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { isModerator } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { termValidators } = require("../validators");

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
 * @route   GET /api/terms/stats
 * @desc    Lấy thống kê thuật ngữ
 * @access  Private - Moderator/Admin
 */
router.get("/stats", authenticate, isModerator, termController.getTermStats);

/**
 * @route   GET /api/terms/export
 * @desc    Xuất danh sách thuật ngữ ra Excel
 * @access  Private - Moderator/Admin
 */
router.get("/export", authenticate, isModerator, termController.exportTerms);

/**
 * @route   GET /api/terms/admin
 * @desc    Lấy danh sách thuật ngữ cho admin (tất cả status)
 * @access  Private - Moderator/Admin
 */
router.get(
  "/admin",
  authenticate,
  isModerator,
  validatePagination,
  termController.getTermsForAdmin,
);

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
  termValidators.create,
  validate,
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
  termValidators.update,
  validate,
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
