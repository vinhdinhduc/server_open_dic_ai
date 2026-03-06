const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const emailService = require("./emailService");
const { TOKEN_EXPIRY } = require("../utils/constants");

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m", // Short-lived access token
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d", // Long-lived refresh token
    },
  );
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
    status: "inactive", // Chuyển sang active để user có thể sử dụng ngay
    emailVerified: false,
  });

  //Send verification email (gửi email chào mừng)

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  newUser.emailVerificationToken = hashedToken;
  newUser.emailVerificationExpires =
    Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION_MS;
  await newUser.save();

  // Gửi email active tài khoản
  await emailService.sendVerificationEmail(
    newUser.email,
    newUser.fullName,
    verificationToken,
  );

  // Không tạo token, user phải verify email trước khi đăng nhập
  return {
    user: {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      preferredLanguage: newUser.preferredLanguage,
      status: newUser.status,
      emailVerified: newUser.emailVerified,
    },
  };
};
// Đăng nhập

exports.login = async (email, password, rememberMe) => {
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
    const error = new Error(
      "Tài khoản của bạn chưa được kích hoạt. Vui lòng kiểm tra email để xác thực tài khoản.",
    );
    error.statusCode = 403;
    throw error;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Hash and save refresh token
  const hashedRefreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpires = Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN_MS; // 30 days
  user.lastLogin = Date.now();
  await user.save();

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      status: user.status,
      emailVerified: user.emailVerified,
      contributionCount: user.contributionCount,
    },
    accessToken,
    refreshToken,
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

  const isGoogleOnlyUser = user.authProvider === "google" && !user.password;

  if (isGoogleOnlyUser) {
    // Google user chưa có mật khẩu — không cần xác minh mật khẩu hiện tại
    if (!newPassword) {
      const error = new Error("Mật khẩu mới là bắt buộc");
      error.statusCode = 400;
      throw error;
    }
  } else {
    // User thường hoặc Google user đã có mật khẩu — phải xác minh mật khẩu hiện tại
    if (!currentPassword) {
      const error = new Error("Mật khẩu hiện tại là bắt buộc");
      error.statusCode = 400;
      throw error;
    }
    const isMatchPassword = await user.comparePassword(currentPassword);
    if (!isMatchPassword) {
      const error = new Error("Mật khẩu hiện tại không đúng");
      error.statusCode = 401;
      throw error;
    }
  }

  user.password = newPassword;
  await user.save();
  return { message: "Đổi mật khẩu thành công" };
};
/**
 * Refresh access token
 */
exports.refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error("Refresh token không được cung cấp");
    error.statusCode = 401;
    throw error;
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    );

    // Hash token to compare with database
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Find user with valid refresh token
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: hashedToken,
      refreshTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      const error = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      error.statusCode = 401;
      throw error;
    }

    // Check if account is still active
    if (user.status === "banned" || user.status === "inactive") {
      const error = new Error("Tài khoản không còn hoạt động");
      error.statusCode = 403;
      throw error;
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    return {
      accessToken: newAccessToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        status: user.status,
      },
    };
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      const err = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
      err.statusCode = 401;
      throw err;
    }
    throw error;
  }
};

/**
 * Logout - xóa refresh token
 */
exports.logout = async (userId) => {
  const user = await User.findById(userId);
  if (user) {
    user.refreshToken = undefined;
    user.refreshTokenExpires = undefined;
    await user.save();
  }
  return { message: "Đăng xuất thành công" };
};

/**
 * Lấy thông tin profile
 */
exports.getProfile = async (userId) => {
  const user = await User.findById(userId).select("+password");

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
    authProvider: user.authProvider,
    hasPassword: !!user.password,
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

  // Tạo reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + TOKEN_EXPIRY.PASSWORD_RESET_MS; // 30 phút
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

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Hash and save refresh token
  const hashedRefreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpires = Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN_MS; // 30 days
  await user.save();

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
    accessToken,
    refreshToken,
  };
};

/**
 * Xác thực email
 */
exports.verifyEmail = async (token) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error(
      "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực",
    );
    error.statusCode = 400;
    throw error;
  }

  user.emailVerified = true;
  user.status = "active"; // Kích hoạt tài khoản khi verify email thành công
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Gửi email chào mừng sau khi verify thành công
  emailService.sendWelcomeEmail(user.email, user.fullName).catch((err) => {
    console.error("Failed to send welcome email:", err);
  });

  return { message: "Xác thực email thành công" };
};

/**
 * Gửi lại email xác thực
 */
exports.resendVerificationEmail = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  if (user.emailVerified) {
    const error = new Error("Email đã được xác thực");
    error.statusCode = 400;
    throw error;
  }

  // Tạo verification token mới
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpires =
    Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION_MS; // 24 giờ
  await user.save();

  // Gửi email
  await emailService.sendVerificationEmail(
    user.email,
    user.fullName,
    verificationToken,
  );

  return { message: "Email xác thực đã được gửi lại" };
};

/**
 * Generate tokens for user (dùng cho Passport callback)
 */
exports.generateTokensForUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Hash and save refresh token
  const hashedRefreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpires = Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN_MS; // 30 days
  user.lastLogin = Date.now();
  await user.save();

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
    accessToken,
    refreshToken,
  };
};
