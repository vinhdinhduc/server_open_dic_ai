const { successResponse } = require("../utils/response");
const authService = require("../services/authService");
const { logAudit, ACTIONS } = require("../services/auditLogService");

//đăng kí

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const user = await authService.register({ fullName, email, password });
    try {
      logAudit({
        action: ACTIONS.USER_CREATE,
        actor: {
          userId: user?.user?.id || null,
          email: user?.user?.email || email,
          fullName: user?.user?.fullName || fullName,
          role: user?.user?.role || "user",
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "user",
          resourceId: user?.user?.id || null,
          resourceName: user?.user?.email || email,
        },
        diff: {
          before: null,
          after: {
            fullName,
            email,
          },
        },
      });
    } catch (e) {
      /* ignore audit failure */
    }
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
    try {
      logAudit({
        action: ACTIONS.LOGIN_SUCCESS,
        actor: {
          userId: result?.user?.id || null,
          email: result?.user?.email || email,
          fullName: result?.user?.fullName || null,
          role: result?.user?.role || null,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "auth",
          resourceId: result?.user?.id || null,
          resourceName: result?.user?.email || email,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore audit failure */
    }

    return successResponse(res, "Đăng nhập thành công", result);
  } catch (error) {
    try {
      logAudit({
        action: ACTIONS.LOGIN_FAILED,
        actor: {
          email: req.body?.email || null,
          fullName: null,
          role: null,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "auth",
          resourceName: req.body?.email || null,
        },
        diff: null,
        status: "failed",
        reason: error.message,
      });
    } catch (e) {
      /* ignore audit failure */
    }
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
    try {
      logAudit({
        action: ACTIONS.USER_UPDATE,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          fullName: req.user?.fullName,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "user",
          resourceId: req.user?._id,
          resourceName: req.user?.email,
        },
        diff: {
          before: null,
          after: updates,
        },
      });
    } catch (e) {
      /* ignore audit failure */
    }

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

    try {
      logAudit({
        action: ACTIONS.PASSWORD_CHANGE,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          fullName: req.user?.fullName,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "user",
          resourceId: req.user?._id,
          resourceName: req.user?.email,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore audit failure */
    }

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
    try {
      logAudit({
        action: ACTIONS.LOGOUT,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          fullName: req.user?.fullName,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "auth",
          resourceId: req.user?._id,
          resourceName: req.user?.email,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore audit failure */
    }
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

    try {
      logAudit({
        action: ACTIONS.EMAIL_VERIFY,
        actor: {
          userId: req.user?._id || null,
          email: req.user?.email || req.body?.email || null,
          fullName: req.user?.fullName || null,
          role: req.user?.role || null,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "user",
          resourceId: req.user?._id || null,
          resourceName: req.user?.email || req.body?.email || null,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore audit failure */
    }

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
