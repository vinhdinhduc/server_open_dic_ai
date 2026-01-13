const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Tạo JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

exports.register = async (username, email, password) => {
  // Kiểm tra user đã tồn tại
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new Error("Email hoặc tên người dùng đã tồn tại");
  }

  // Tạo user mới
  const user = await User.create({
    username,
    email,
    password,
  });

  // Tạo token
  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    token,
  };
};

exports.login = async (email, password) => {
  // Kiểm tra user có tồn tại không
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new Error("Email hoặc mật khẩu không chính xác");
  }

  // Kiểm tra mật khẩu
  const isPasswordMatch = await user.matchPassword(password);

  if (!isPasswordMatch) {
    throw new Error("Email hoặc mật khẩu không chính xác");
  }

  // Kiểm tra tài khoản có bị khóa không
  if (!user.isActive) {
    throw new Error("Tài khoản đã bị vô hiệu hóa");
  }

  // Tạo token
  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    token,
  };
};

exports.updateProfile = async (userId, updates) => {
  const allowedUpdates = ["username", "avatar"];
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new Error("Không tìm thấy người dùng");
  }

  return { user };
};
