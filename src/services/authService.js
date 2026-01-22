const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

//Đăng kí tài khoản mới
exports.register = async ({ fullName, email, password }) => {
  // kiểm tra email đã tồn tại chưa

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    const error = new Error("Email đã được sử dụng");
    error.statusCode = 400;
    throw error;
  }
  //Tạo user mới

  const newUser = await User.create({
    fullName,
    email,
    password,
    status: "inactive",
    emailVerified: false,
  });

  //Send verification email (bỏ qua bước này trong ví dụ)
  user.lastLogin = Date.now();
  await user.save();
  // Gen token

  const token = generateToken(newUser._id);

  return {
    user: {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      preferredLanguage: newUser.preferredLanguage,
      status: newUser.status,
    },
    token,
  };
};
// Đăng nhập

exports.login = async (email, password) => {
  //Check user tồn tại
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    const error = new Error("Email hoặc mật khẩu không đúng");
    error.statusCode = 401;
    throw error;
  }

  const isMatchPassword = await user.comparePassword(password);
  if (!isMatchPassword) {
    const error = new Error("Email hoặc mật khẩu không đúng");
    error.statusCode = 401;
    throw error;
  }

  // kiểm tra tài khoản có bị khóa không
  if (user.status === "banned") {
    const error = new Error("Tài khoản của bạn đã bị khóa");
    error.statusCode = 403;
    throw error;
  }
  if (user.status === "inactive") {
    const error = new Error("Tài khoản của bạn chưa được kích hoạt");
    error.statusCode = 403;
    throw error;
  }

  user.lastLogin = Date.now();
  await user.save();

  // Gen token

  const token = generateToken(user._id);
  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      status: user.status,
      contributionCount: user.contributionCount,
    },
    token,
  };
};
//Update profile

exports.updateProfile = async (userId, updates) => {
  const allowedUpdates = ["fullName", "preferredLanguage"];
  const filteredUpdates = {};
  Object.keys(updates).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  const updatedUser = await User.findByIdAndUpdate(userId, filteredUpdates, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  return {
    id: updatedUser._id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    role: updatedUser.role,
    preferredLanguage: updatedUser.preferredLanguage,
    status: updatedUser.status,
    contributionCount: updatedUser.contributionCount,
  };
};

//Change password

exports.changePassword = async (userId, currentPassword, newPassword) => {
  // kiểm tra user tồn tại
  const user = await User.findById(userId).select("+password");
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  // kiểm tra mật khẩu hiện tại
  const isMatchPassword = await user.comparePassword(currentPassword);
  if (!isMatchPassword) {
    const error = new Error("Mật khẩu hiện tại không đúng");
    error.statusCode = 401;
    throw error;
  }

  user.password = newPassword;
  await user.save();
  return { message: "Đổi mật khẩu thành công" };
};
/**
 * Lấy thông tin profile
 */
exports.getProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("Không tìm thấy người dùng");
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    status: user.status,
    contributionCount: user.contributionCount,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
};
