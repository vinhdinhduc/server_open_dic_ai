const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const emailService = require("./emailService");

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
    status: "active", // Chuyển sang active để user có thể sử dụng ngay
    emailVerified: false,
  });

  //Send verification email (gửi email chào mừng)
  newUser.lastLogin = Date.now();
  await newUser.save();

  // Gửi email chào mừng (không chờ kết quả)
  emailService
    .sendWelcomeEmail(newUser.email, newUser.fullName)
    .catch((err) => {
      console.error("Failed to send welcome email:", err);
    });

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
    accessToken: token,
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
    accessToken: token,
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

/**
 * Quên mật khẩu - gửi email reset
 */
exports.forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Email không tồn tại trong hệ thống");
    error.statusCode = 404;
    throw error;
  }

  if (user.authProvider === "google") {
    const error = new Error(
      "Tài khoản này đăng nhập bằng Google, không thể đặt lại mật khẩu",
    );
    error.statusCode = 400;
    throw error;
  }

  // Tạo reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 phút
  await user.save();

  // Gửi email
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await emailService.sendPasswordResetEmail(
    user.email,
    user.fullName,
    resetUrl,
  );

  return { message: "Email đặt lại mật khẩu đã được gửi" };
};

/**
 * Đặt lại mật khẩu
 */
exports.resetPassword = async (token, newPassword) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error(
      "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại",
    );
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: "Đặt lại mật khẩu thành công" };
};

/**
 * Đăng nhập bằng Google
 */
exports.googleLogin = async (googleData) => {
  const { googleId, email, fullName, avatar } = googleData;

  // Tìm user bằng googleId hoặc email
  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  });

  if (user) {
    // User tồn tại
    if (user.status === "banned") {
      const error = new Error("Tài khoản của bạn đã bị khóa");
      error.statusCode = 403;
      throw error;
    }

    // Cập nhật googleId nếu chưa có (user đã đăng ký bằng email trước đó)
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";
    }
    if (avatar && !user.avatar) {
      user.avatar = avatar;
    }
    user.emailVerified = true;
    user.lastLogin = Date.now();
    await user.save();
  } else {
    // Tạo user mới
    user = await User.create({
      googleId,
      email,
      fullName,
      avatar,
      authProvider: "google",
      emailVerified: true,
      status: "active",
      lastLogin: Date.now(),
    });
  }

  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      preferredLanguage: user.preferredLanguage,
      status: user.status,
      contributionCount: user.contributionCount,
    },
    accessToken: token,
  };
};
