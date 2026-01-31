const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const { authValidators } = require("../validators");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post(
  "/register",
  authValidators.register,
  validate,
  authController.register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post("/login", authValidators.login, validate, authController.login);

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

module.exports = router;
