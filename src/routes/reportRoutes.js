const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authenticate } = require("../middlewares/auth");
const {
  isModerator,
  checkModeratorPermission,
} = require("../middlewares/authorize");
const { validatePagination, validate } = require("../middlewares/validate");
const { MODERATION_PERMISSIONS } = require("../utils/constants");
const { reportValidators } = require("../validators");
const { verifyRecaptcha } = require("../middlewares/recaptcha");

// Tạo báo xấu - User đã đăng nhập
router.post(
  "/",
  authenticate,
  verifyRecaptcha,
  reportValidators.create,
  validate,
  reportController.createReport,
);

// Lấy thống kê báo xấu - Moderator/Quản trị viên
router.get(
  "/stats",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.getReportStats,
);

// Lấy danh sách báo xấu - Moderator/Quản trị viên (chỉ trong danh mục được phép)
router.get(
  "/",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  validatePagination,
  reportController.getReports,
);

// Lấy chi tiết báo xấu - Moderator/Quản trị viên
router.get(
  "/:id",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.getReportById,
);

// Xử lý báo xấu (resolve/reject) - Moderator/Quản trị viên
router.put(
  "/:id/resolve",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportValidators.resolve,
  validate,
  reportController.resolveReport,
);

// Xóa mềm báo xấu - Moderator/Quản trị viên
router.delete(
  "/:id",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.deleteReport,
);

// Khôi phục báo xấu - Moderator/Quản trị viên
router.put(
  "/:id/restore",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.restoreReport,
);

// Làm rỗng thùng rác báo xấu - Moderator/Quản trị viên
router.delete(
  "/trash/empty",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.emptyReportTrash,
);

module.exports = router;
