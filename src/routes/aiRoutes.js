const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const auth = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const { aiLimiter } = require("../middlewares/rateLimiter");

// @route   POST /api/ai/ask
// @desc    Hỏi AI về thuật ngữ
// @access  Private
router.post(
  "/ask",
  auth.authenticate,
  aiLimiter, // Giới hạn 5 AI requests/phút
  aiController.askAboutTerm,
);

// @route   GET /api/ai/history
// @desc    Lấy lịch sử chat AI
// @access  Private
router.get("/history", auth.authenticate, aiController.getChatHistory);

// @route   GET /api/ai/status
// @desc    Kiểm tra trạng thái dịch vụ AI
// @access  Private
router.get("/status", auth.authenticate, aiController.getAIStatus);

// @route   GET /api/ai/config
// @desc    Lấy cấu hình AI hiện tại
// @access  Private (Admin only)
router.get("/config", auth.authenticate, isAdmin, aiController.getConfig);

// @route   PUT /api/ai/config
// @desc    Cập nhật cấu hình AI
// @access  Private (Admin only)
router.put("/config", auth.authenticate, isAdmin, aiController.updateConfig);

// @route   POST /api/ai/test
// @desc    Test kết nối AI
// @access  Private (Admin only)
router.post("/test", auth.authenticate, isAdmin, aiController.testConnection);

module.exports = router;
