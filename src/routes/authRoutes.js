const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const { authValidators } = require("../validators");

// Import rate limiters cho các endpoints quan trọng
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} = require("../middlewares/rateLimiter");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post(
  "/register",
  registerLimiter, // Giới hạn số lượng đăng ký từ 1 IP
  authValidators.register,
  validate,
  authController.register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post(
  "/login",
  // loginLimiter,
  authValidators.login,
  validate,
  authController.login,
);

/**
 * @route   GET /api/auth/profile
 * @desc    Lấy thông tin profile
 * @access  Private
 */
router.get("/profile", authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Cập nhật profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  authValidators.updateProfile,
  validate,
  authController.updateProfile,
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Gửi email đặt lại mật khẩu
 * @access  Public
 */
router.post(
  "/forgot-password",
  passwordResetLimiter, // Giới hạn số lần yêu cầu reset password
  authController.forgotPassword,
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Đặt lại mật khẩu bằng token
 * @access  Public
 */
router.post(
  "/reset-password",
  passwordResetLimiter, // Giới hạn số lần thử reset
  authController.resetPassword,
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Đổi mật khẩu (khi đã đăng nhập)
 * @access  Private
 */
router.put(
  "/change-password",
  authenticate,
  authValidators.changePassword,
  validate,
  authController.changePassword,
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Xác thực email bằng token
 * @access  Public
 */
router.post("/verify-email", authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Gửi lại email xác thực
 * @access  Private
 */
router.post(
  "/resend-verification",
  authenticate,
  authController.resendVerificationEmail,
);

/**
 * @route   POST /api/auth/google
 * @desc    Đăng nhập bằng Google (Frontend OAuth flow)
 * @access  Public
 */
router.post(
  "/google",
  loginLimiter, // Áp dụng rate limiting giống như login thường
  authValidators.googleLogin,
  validate,
  authController.googleLogin,
);

/**
 * @route   GET /api/auth/google/passport
 * @desc    Khởi động Google OAuth flow (Passport.js)
 * @access  Public
 */
router.get(
  "/google/passport",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback (Passport.js)
 * @access  Public
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL || "http://localhost:3000"}/login?error=google_auth_failed`,
  }),
  authController.googleCallback,
);

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất
 * @access  Private
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh-token", authController.refreshToken);

module.exports = router;
