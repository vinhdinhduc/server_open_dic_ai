const { options } = require("../app");
const User = require("../models/User");
const { USER_ROLES } = require("../utils/constants");

/**
 * Tạo người dùng mới (Admin tạo)
 */
exports.createUser = async (userData) => {
  const { email, password, fullName, role, status, preferredLanguage } =
    userData;

  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error("Email đã được sử dụng");
    error.statusCode = 400;
    throw error;
  }

  // Tạo user mới
  const user = new User({
    email: email.toLowerCase(),
    password,
    fullName,
    role: role || "user",
    status: status || "active",
    preferredLanguage: preferredLanguage || "vi",
    emailVerified: true, // Quản trị viên tạo thì mặc định đã xác thực
  });

  await user.save();

  // Loại bỏ password trước khi trả về
  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

//Lấy danh sách người dùng

exports.getUsers = async (options) => {
  const { page = 1, limit = 10, role, status, search } = options;

  const skip = (page - 1) * limit;
  const query = {};

  if (role) query.role = role;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(query).skip(skip).limit(limit).select("-password").lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Lấy chi tiết người dùng
exports.getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  return user;
};

// Cập nhật thông tin người dùng
exports.updateUser = async (userId, updateData) => {
  const allowedUpdates = [
    "fullName",
    "role",
    "status",
    "preferredLanguage",
    "moderationPermissions",
  ];

  const filteredData = {};
  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  // Chuẩn hóa moderationPermissions nếu tồn tại - đảm bảo các trường mảng đúng kiểu
  if (filteredData.moderationPermissions) {
    const mp = filteredData.moderationPermissions;

    // Convert permissions to proper array if it's an object or string
    if (mp.permissions) {
      if (typeof mp.permissions === "string") {
        try {
          mp.permissions = JSON.parse(mp.permissions);
        } catch (e) {
          mp.permissions = [];
        }
      }
      // Chuyển object có key dạng số thành mảng
      if (
        mp.permissions &&
        typeof mp.permissions === "object" &&
        !Array.isArray(mp.permissions)
      ) {
        mp.permissions = Object.values(mp.permissions);
      }
      // Ensure it's an array
      if (!Array.isArray(mp.permissions)) {
        mp.permissions = [];
      }
    }

    // Convert categories to proper array if it's an object or string
    if (mp.categories) {
      if (typeof mp.categories === "string") {
        try {
          mp.categories = JSON.parse(mp.categories);
        } catch (e) {
          mp.categories = [];
        }
      }
      // Chuyển object có key dạng số thành mảng
      if (
        mp.categories &&
        typeof mp.categories === "object" &&
        !Array.isArray(mp.categories)
      ) {
        mp.categories = Object.values(mp.categories);
      }
      // Ensure it's an array
      if (!Array.isArray(mp.categories)) {
        mp.categories = [];
      }
    }
  }

  const user = await User.findByIdAndUpdate(userId, filteredData, {
    new: true,
    runValidators: true,
  }).select("-password");
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  return user;
};

//Moá/mở khóa tài khoản

exports.toggleUserStatus = async (userId, status) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  user.status = status;
  await user.save();
  return user;
};
/**
 * Xóa người dùng
 */
exports.deleteUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("Không tìm thấy người dùng");
    error.statusCode = 404;
    throw error;
  }

  // Không cho xóa admin
  if (user.role === USER_ROLES.ADMIN) {
    const error = new Error("Không thể xóa tài khoản Admin");
    error.statusCode = 400;
    throw error;
  }

  await user.deleteOne();

  return { message: "Xóa người dùng thành công" };
};

/**
 * Thống kê người dùng
 */
exports.getUserStats = async () => {
  const [total, active, inactive, banned, byRole] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "inactive" }),
    User.countDocuments({ status: "banned" }),
    User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const roleStats = {};
  byRole.forEach((item) => {
    roleStats[item._id] = item.count;
  });

  return {
    total,
    byStatus: {
      active,
      inactive,
      banned,
    },
    byRole: roleStats,
  };
};

/**
 * Reset password cho user (Admin)
 */
exports.resetUserPassword = async (userId, newPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Không tìm thấy người dùng");
    error.statusCode = 404;
    throw error;
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: "Đặt lại mật khẩu thành công" };
};

/**
 * Gửi lại email xác thực
 */
exports.resendVerificationEmail = async (userId) => {
  const emailService = require("./emailService");
  const crypto = require("crypto");

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Không tìm thấy người dùng");
    error.statusCode = 404;
    throw error;
  }

  if (user.emailVerified) {
    const error = new Error("Email đã được xác thực");
    error.statusCode = 400;
    throw error;
  }

  // Tạo token xác minh
  const verificationToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  await user.save();

  // Gửi email xác thực
  await emailService.sendVerificationEmail(user.email, verificationToken);

  return { message: "Email xác thực đã được gửi lại" };
};

/**
 * Batch update status
 */
exports.batchUpdateStatus = async (userIds, status) => {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    const error = new Error("Danh sách user ID không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  // Không cho phép thao tác với admin
  const adminUsers = await User.find({
    _id: { $in: userIds },
    role: USER_ROLES.ADMIN,
  });

  if (adminUsers.length > 0) {
    const error = new Error("Không thể thay đổi trạng thái tài khoản Admin");
    error.statusCode = 400;
    throw error;
  }

  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: { status } },
  );

  return {
    message: `Đã cập nhật trạng thái cho ${result.modifiedCount} người dùng`,
    updated: result.modifiedCount,
  };
};

/**
 * Lấy lịch sử hoạt động của user
 */
exports.getUserActivity = async (userId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("Không tìm thấy người dùng");
    error.statusCode = 404;
    throw error;
  }

  const Term = require("../models/Term");
  const Comment = require("../models/Comment");
  const Contribution = require("../models/Contribution");
  const Report = require("../models/Report");

  // Lấy các hoạt động khác nhau
  const [terms, comments, contributions, reports, totalCounts] =
    await Promise.all([
      Term.find({ createdBy: userId })
        .select("term status createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Comment.find({ userId })
        .select("content status createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Contribution.find({ userId })
        .select("type status createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Report.find({ reportedBy: userId })
        .select("reason status createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Promise.all([
        Term.countDocuments({ createdBy: userId }),
        Comment.countDocuments({ userId }),
        Contribution.countDocuments({ userId }),
        Report.countDocuments({ reportedBy: userId }),
      ]),
    ]);

  // Kết hợp và sắp xếp theo thời gian
  const activities = [
    ...terms.map((t) => ({ ...t, type: "term" })),
    ...comments.map((c) => ({ ...c, type: "comment" })),
    ...contributions.map((c) => ({ ...c, type: "contribution" })),
    ...reports.map((r) => ({ ...r, type: "report" })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(skip, skip + limit);

  const [termCount, commentCount, contributionCount, reportCount] = totalCounts;

  return {
    activities,
    stats: {
      terms: termCount,
      comments: commentCount,
      contributions: contributionCount,
      reports: reportCount,
      total: termCount + commentCount + contributionCount + reportCount,
    },
    pagination: {
      page,
      limit,
      total: termCount + commentCount + contributionCount + reportCount,
      pages: Math.ceil(
        (termCount + commentCount + contributionCount + reportCount) / limit,
      ),
    },
  };
};
