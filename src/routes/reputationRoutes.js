const express = require("express");
const router = express.Router();
const reputationController = require("../controllers/reputationController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { validatePagination } = require("../middlewares/validate");

// Điểm uy tín của user hiện tại
router.get("/me", authenticate, reputationController.getMyReputation);

// Lịch sử điểm
router.get(
  "/history",
  authenticate,
  validatePagination,
  reputationController.getMyHistory,
);

// Kiểm tra quyền AI
router.get("/ai-access", authenticate, reputationController.checkAIAccess);

// Xác minh sinh viên ĐHTB
router.post("/verify-utb", authenticate, reputationController.verifyUtb);

// Yêu cầu đổi điểm rèn luyện
router.post("/redeem", authenticate, reputationController.requestRedemption);

// Lịch sử đổi điểm
router.get(
  "/redemptions",
  authenticate,
  validatePagination,
  reputationController.getMyRedemptions,
);

// Tải PDF giấy xác nhận
router.get(
  "/redemptions/:id/certificate",
  authenticate,
  reputationController.downloadCertificate,
);

// Bảng xếp hạng (công khai)
router.get(
  "/leaderboard",
  validatePagination,
  reputationController.getLeaderboard,
);

// Xem ĐUT của user cụ thể
router.get(
  "/users/:userId",
  authenticate,
  isAdmin,
  reputationController.getUserReputation,
);

// Điều chỉnh điểm
router.post(
  "/admin/adjust",
  authenticate,
  isAdmin,
  reputationController.adminAdjust,
);

// Danh sách yêu cầu đổi điểm
router.get(
  "/admin/redemptions",
  authenticate,
  isAdmin,
  validatePagination,
  reputationController.getAllRedemptions,
);

// Duyệt/từ chối yêu cầu
router.put(
  "/admin/redemptions/:id",
  authenticate,
  isAdmin,
  reputationController.reviewRedemption,
);

// Tải PDF giấy xác nhận (quản trị viên)
router.get(
  "/admin/redemptions/:id/certificate",
  authenticate,
  isAdmin,
  reputationController.downloadCertificate,
);

module.exports = router;
