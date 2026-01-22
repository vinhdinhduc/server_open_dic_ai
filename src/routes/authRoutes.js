const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post(
  "/register",
  [
    body("fullName")
      .trim()
      .notEmpty()
      .withMessage("Họ tên là bắt buộc")
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ")
      .normalizeEmail(),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Mật khẩu là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    validate,
  ],
  authController.register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ"),
    body("password").trim().notEmpty().withMessage("Mật khẩu là bắt buộc"),
    validate,
  ],
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
  [
    body("fullName")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("preferredLanguage")
      .optional()
      .isIn(["vi", "lo", "en"])
      .withMessage("Ngôn ngữ không hợp lệ"),
    validate,
  ],
  authController.updateProfile,
);

module.exports = router;
