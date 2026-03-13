const express = require("express");
const router = express.Router();
const reputationController = require("../controllers/reputationController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { validatePagination } = require("../middlewares/validate");

// ===== User routes =====

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

// Tải PDF giấy xác nhận (user tải của mình)
router.get(
  "/redemptions/:id/certificate",
  authenticate,
  reputationController.downloadCertificate,
);

// Bảng xếp hạng (public)
router.get(
  "/leaderboard",
  validatePagination,
  reputationController.getLeaderboard,
);

// ===== Admin routes =====

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

// Tải PDF giấy xác nhận (admin)
router.get(
  "/admin/redemptions/:id/certificate",
  authenticate,
  isAdmin,
  reputationController.downloadCertificate,
);

module.exports = router;
