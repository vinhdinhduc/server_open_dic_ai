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
 * @route   GET /api/users/email-config
 * @desc    Lấy cấu hình email
 * @access  Private - Admin
 */
router.get("/email-config", userController.getEmailConfig);

/**
 * @route   PUT /api/users/email-config
 * @desc    Cập nhật cấu hình email
 * @access  Private - Admin
 */
router.put("/email-config", userController.updateEmailConfig);
router.get("/email-templates", userController.getEmailTemplates);
router.put("/email-templates/:key", userController.updateEmailTemplate);
router.delete("/email-templates/:key", userController.resetEmailTemplate);
/**
 * @route   POST /api/users/test-email
 * @desc    Test cấu hình email
 * @access  Private - Admin
 */
router.post("/test-email", userController.testEmailConfig);

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng
 * @access  Private - Admin
 */
router.get("/", validatePagination, userController.getUsers);

/**
 * @route   GET /api/users/export/excel
 * @desc    Xuất danh sách người dùng ra Excel
 * @access  Private - Admin
 */
router.get("/export/excel", userController.exportUsersToExcel);

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

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Admin reset password cho user
 * @access  Private - Admin
 */
router.post(
  "/:id/reset-password",
  validateObjectId("id"),
  userValidators.resetPassword,
  validate,
  userController.resetUserPassword,
);

/**
 * @route   POST /api/users/:id/resend-verification
 * @desc    Admin gửi lại email xác thực
 * @access  Private - Admin
 */
router.post(
  "/:id/resend-verification",
  validateObjectId("id"),
  userController.resendVerificationEmail,
);

/**
 * @route   POST /api/users/batch-update-status
 * @desc    Update status cho nhiều user
 * @access  Private - Admin
 */
router.post(
  "/batch-update-status",
  userValidators.batchUpdateStatus,
  validate,
  userController.batchUpdateStatus,
);

/**
 * @route   GET /api/users/:id/activity
 * @desc    Lấy lịch sử hoạt động user
 * @access  Private - Admin/Moderator
 */
router.get(
  "/:id/activity",
  validateObjectId("id"),
  validatePagination,
  userController.getUserActivity,
);

module.exports = router;
