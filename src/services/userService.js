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
    emailVerified: true, // Admin tạo thì mặc định đã xác thực
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
    return user;
  }
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
  console.log("Check data", userId, updateData);

  const filteredData = {};
  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

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
