const express = require("express");
const multer = require("multer");
const path = require("path");
const termController = require("../controllers/termController");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { isModerator, isAdmin } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { termValidators } = require("../validators");

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, "../../uploads/"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const allowedExts = [".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file Excel (.xlsx, .xls) và CSV (.csv)"));
    }
  },
});

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
 * @route   POST /api/terms/import
 * @desc    Nhập thuật ngữ từ file Excel/CSV
 * @access  Private - Admin
 */
router.post(
  "/import",
  authenticate,
  isAdmin,
  upload.single("file"),
  termController.importTerms,
);

/**
 * @route   GET /api/terms/search-history
 * @desc    Lấy lịch sử tìm kiếm
 * @access  Private
 */
router.get(
  "/search-history",
  authenticate,
  validatePagination,
  termController.getSearchHistory,
);

/**
 * @route   DELETE /api/terms/search-history/all
 * @desc    Xóa toàn bộ lịch sử tìm kiếm
 * @access  Private
 */
router.delete(
  "/search-history/all",
  authenticate,
  termController.clearSearchHistory,
);

/**
 * @route   DELETE /api/terms/search-history/:id
 * @desc    Xóa một mục lịch sử tìm kiếm
 * @access  Private
 */
router.delete(
  "/search-history/:id",
  authenticate,
  validateObjectId("id"),
  termController.deleteSearchHistory,
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
