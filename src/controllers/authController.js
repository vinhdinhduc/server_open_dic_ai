const { successResponse } = require("../utils/response");
const authService = require("../services/authService");

//đăng kí

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const user = await authService.register({ fullName, email, password });
    successResponse(res, "Đăng ký thành công", user, 201);
  } catch (error) {
    next(error);
  }
};
/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    const result = await authService.login(email, password, rememberMe);

    return successResponse(res, "Đăng nhập thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/profile
 * @desc    Lấy thông tin profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile = await authService.getProfile(userId);

    return successResponse(res, "Lấy thông tin thành công", profile);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Cập nhật profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const result = await authService.updateProfile(userId, updates);

    return successResponse(res, "Cập nhật thông tin thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Đổi mật khẩu
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất - xóa refresh token
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await authService.logout(userId);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Lấy access token mới bằng refresh token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      const error = new Error("Refresh token là bắt buộc");
      error.statusCode = 400;
      throw error;
    }

    const result = await authService.refreshAccessToken(refreshToken);
    return successResponse(res, "Lấy token mới thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Gửi email đặt lại mật khẩu
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Đặt lại mật khẩu bằng token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/google
 * @desc    Đăng nhập bằng Google (Frontend OAuth flow)
 * @access  Public
 */
exports.googleLogin = async (req, res, next) => {
  try {
    const { googleId, email, fullName, avatar } = req.body;
    const result = await authService.googleLogin({
      googleId,
      email,
      fullName,
      avatar,
    });
    return successResponse(res, "Đăng nhập Google thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback (Passport.js)
 * @access  Public
 */
exports.googleCallback = async (req, res, next) => {
  try {
    // User đã được Passport authenticate và attach vào req.user
    const user = req.user;

    if (!user) {
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/login?error=authentication_failed`,
      );
    }

    // Tạo token
    const result = await authService.generateTokensForUser(user._id);

    // Redirect về frontend với tokens trong URL query
    // Frontend sẽ lấy tokens từ URL và lưu vào localStorage
    const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google callback error:", error);
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:3000"}/login?error=callback_failed`,
    );
  }
};

/**
 * @route   POST /api/auth/verify-email
 * @desc    Xác thực email bằng token
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      const error = new Error("Token xác thực là bắt buộc");
      error.statusCode = 400;
      throw error;
    }

    const result = await authService.verifyEmail(token);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Gửi lại email xác thực
 * @access  Private
 */
exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await authService.resendVerificationEmail(userId);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};
