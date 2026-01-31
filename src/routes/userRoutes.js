const express = require("express");
const userController = require("../controllers/userController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { userValidators } = require("../validators");

const router = express.Router();

// Tất cả routes đều yêu cầu Admin
router.use(authenticate, isAdmin);

/**
 * @route   GET /api/users/stats
 * @desc    Thống kê người dùng
 * @access  Private - Admin
 */
router.get("/stats", userController.getUserStats);

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng
 * @access  Private - Admin
 */
router.get("/", validatePagination, userController.getUsers);

/**
 * @route   POST /api/users
 * @desc    Tạo người dùng mới
 * @access  Private - Admin
 */
router.post("/", userValidators.create, validate, userController.createUser);

/**
 * @route   GET /api/users/:id
 * @desc    Lấy chi tiết người dùng
 * @access  Private - Admin
 */
router.get("/:id", validateObjectId("id"), userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Cập nhật thông tin người dùng
 * @access  Private - Admin
 */
router.put(
  "/:id",
  validateObjectId("id"),
  userValidators.update,
  validate,
  userController.updateUser,
);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Khóa/mở khóa tài khoản
 * @access  Private - Admin
 */
router.put(
  "/:id/status",
  validateObjectId("id"),
  userValidators.toggleStatus,
  validate,
  userController.toggleUserStatus,
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa người dùng
 * @access  Private - Admin
 */
router.delete("/:id", validateObjectId("id"), userController.deleteUser);

module.exports = router;
