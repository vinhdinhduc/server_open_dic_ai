const express = require("express");
const notificationController = require("../controllers/notificationController");
const { authenticate } = require("../middlewares/auth");
const {
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách thông báo
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  validatePagination,
  notificationController.getNotifications,
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Đánh dấu đã đọc
 * @access  Private
 */
router.put(
  "/:id/read",
  authenticate,
  validateObjectId("id"),
  notificationController.markAsRead,
);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Đánh dấu tất cả đã đọc
 * @access  Private
 */
router.put("/read-all", authenticate, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Xóa thông báo
 * @access  Private
 */
router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  notificationController.deleteNotification,
);

module.exports = router;
