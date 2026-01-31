const { successResponse } = require("../utils/response");
const notificationService = require("../services/notificationService");

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách thông báo
 * @access  Private
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { isRead } = req.query;
    const { page, limit } = req.pagination;

    const result = await notificationService.getNotifications(userId, {
      page,
      limit,
      isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
    });

    return successResponse(res, "Lấy danh sách thông báo thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Đánh dấu đã đọc
 * @access  Private
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(userId, id);

    return successResponse(
      res,
      "Đã đánh dấu thông báo là đã đọc",
      notification,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Đánh dấu tất cả đã đọc
 * @access  Private
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await notificationService.markAllAsRead(userId);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Xóa thông báo
 * @access  Private
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await notificationService.deleteNotification(userId, id);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};
