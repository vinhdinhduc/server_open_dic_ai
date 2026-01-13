const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { protect } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");

// Đăng ký
router.post(
  "/register",
  [
    body("username")
      .trim()
      .isLength({ min: 3 })
      .withMessage("Tên người dùng phải có ít nhất 3 ký tự"),
    body("email").isEmail().withMessage("Email không hợp lệ"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    validate,
  ],
  authController.register
);

// Đăng nhập
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email không hợp lệ"),
    body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu"),
    validate,
  ],
  authController.login
);

// Lấy thông tin profile (yêu cầu authentication)
router.get("/profile", protect, authController.getProfile);

// Cập nhật profile
router.put("/profile", protect, authController.updateProfile);

module.exports = router;
