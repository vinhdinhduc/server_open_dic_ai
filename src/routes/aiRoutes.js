const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const auth = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { aiLimiter } = require("../middlewares/rateLimiter");

// @route   POST /api/ai/ask
// @desc    Hỏi AI về thuật ngữ
// @access  Riêng tư
router.post(
  "/ask",
  auth.authenticate,
  aiLimiter, // Giới hạn 5 AI requests/phút
  aiController.askAboutTerm,
);

// @route   GET /api/ai/history
// @desc    Lấy lịch sử chat AI
// @access  Riêng tư
router.get("/history", auth.authenticate, aiController.getChatHistory);

// @route   GET /api/ai/status
// @desc    Kiểm tra trạng thái dịch vụ AI
// @access  Riêng tư
router.get("/status", auth.authenticate, aiController.getAIStatus);

// @route   GET /api/ai/config
// @desc    Lấy cấu hình AI hiện tại
// @access  Riêng tư (chỉ Admin)
router.get("/config", auth.authenticate, isAdmin, aiController.getConfig);

// @route   PUT /api/ai/config
// @desc    Cập nhật cấu hình AI
// @access  Riêng tư (chỉ Admin)
router.put("/config", auth.authenticate, isAdmin, aiController.updateConfig);

// @route   POST /api/ai/ask-about-term
// @desc    AI trả lời câu hỏi về một thuật ngữ cụ thể (từ trang chi tiết)
// @access  Riêng tư
router.post(
  "/ask-about-term",
  auth.authenticate,
  aiLimiter,
  aiController.askAboutSpecificTerm,
);

// @route   POST /api/ai/test
// @desc    Kiểm tra kết nối AI
// @access  Riêng tư (chỉ Admin)
router.post("/test", auth.authenticate, isAdmin, aiController.testConnection);

// @route   GET /api/ai/usage
// @desc    Lấy thống kê sử dụng API trong ngày
// @access  Riêng tư (chỉ Admin)
router.get("/usage", auth.authenticate, isAdmin, aiController.getAPIUsage);

module.exports = router;
