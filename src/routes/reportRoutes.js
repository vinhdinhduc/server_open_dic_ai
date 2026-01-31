const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authenticate } = require("../middlewares/auth");
const {
  isModerator,
  checkModeratorPermission,
} = require("../middlewares/authorize");
const { validatePagination } = require("../middlewares/validate");
const { MODERATION_PERMISSIONS } = require("../utils/constants");

// Tạo báo xấu - User đã đăng nhập
router.post("/", authenticate, reportController.createReport);

// Lấy thống kê báo xấu - Moderator/Admin
router.get(
  "/stats",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.getReportStats,
);

// Lấy danh sách báo xấu - Moderator/Admin (chỉ trong danh mục được phép)
router.get(
  "/",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  validatePagination,
  reportController.getReports,
);

// Lấy chi tiết báo xấu - Moderator/Admin
router.get(
  "/:id",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.getReportById,
);

// Xử lý báo xấu (resolve/reject) - Moderator/Admin
router.put(
  "/:id/resolve",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.REPORTS),
  reportController.resolveReport,
);

module.exports = router;
