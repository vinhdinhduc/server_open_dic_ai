const Notification = require("../models/Notification");
const User = require("../models/User");
const { USER_ROLES } = require("../utils/constants");

/**
 * Lấy danh sách thông báo của user
 */
exports.getNotifications = async (userId, options = {}) => {
  const { page = 1, limit = 20, isRead } = options;
  const skip = (page - 1) * limit;

  const query = { recipient: userId };
  if (typeof isRead === "boolean") {
    query.isRead = isRead;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    unreadCount,
  };
};

/**
 * Đánh dấu đã đọc
 */
exports.markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    const error = new Error("Không tìm thấy thông báo");
    error.statusCode = 404;
    throw error;
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

/**
 * Đánh dấu tất cả đã đọc
 */
exports.markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true },
  );

  return { message: "Đã đánh dấu tất cả thông báo là đã đọc" };
};

/**
 * Xóa thông báo
 */
exports.deleteNotification = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    const error = new Error("Không tìm thấy thông báo");
    error.statusCode = 404;
    throw error;
  }

  await notification.deleteOne();

  return { message: "Xóa thông báo thành công" };
};

/**
 * Tạo thông báo mới (dùng internally)
 */
exports.createNotification = async (notificationData) => {
  const notification = await Notification.create(notificationData);
  return notification;
};

/**
 * Lấy số thông báo chưa đọc
 */
exports.getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
  return count;
};

/**
 * Gửi thông báo cho tất cả admin
 */
exports.notifyAdmins = async (notificationData) => {
  try {
    const admins = await User.find({
      role: USER_ROLES.ADMIN,
      status: "active",
    }).select("_id");

    const notifications = admins.map((admin) => ({
      ...notificationData,
      recipient: admin._id,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    return notifications.length;
  } catch (error) {
    console.error("Error notifying admins:", error);
    return 0;
  }
};

/**
 * Gửi thông báo cho moderator có quyền trong danh mục cụ thể
 */
exports.notifyModeratorsForCategory = async (categoryId, notificationData) => {
  try {
    // Tìm moderators được gán cho danh mục này
    const moderators = await User.find({
      role: USER_ROLES.MODERATOR,
      status: "active",
      "moderationPermissions.categories": categoryId,
    }).select("_id");

    // Cũng gửi cho tất cả admin
    const admins = await User.find({
      role: USER_ROLES.ADMIN,
      status: "active",
    }).select("_id");

    const allRecipients = [...moderators, ...admins];
    // Loại bỏ trùng lặp
    const uniqueIds = [...new Set(allRecipients.map((u) => u._id.toString()))];

    const notifications = uniqueIds.map((recipientId) => ({
      ...notificationData,
      recipient: recipientId,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    return notifications.length;
  } catch (error) {
    console.error("Error notifying moderators for category:", error);
    return 0;
  }
};
