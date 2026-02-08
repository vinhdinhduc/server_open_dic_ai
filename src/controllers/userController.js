const { successResponse } = require("../utils/response");
const userService = require("../services/userService");
const exportService = require("../services/exportService");
const emailService = require("../services/emailService");
const SystemConfig = require("../models/SystemConfig");

/**
 * @route   POST /api/users
 * @desc    Tạo người dùng mới
 * @access  Private - Admin
 */
exports.createUser = async (req, res, next) => {
  try {
    const userData = req.body;

    const user = await userService.createUser(userData);

    return successResponse(res, "Tạo người dùng thành công", user, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng
 * @access  Private - Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const { page, limit } = req.pagination;

    const result = await userService.getUsers({
      page,
      limit,
      role,
      status,
      search,
    });

    return successResponse(res, "Lấy danh sách người dùng thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id
 * @desc    Lấy chi tiết người dùng
 * @access  Private - Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    return successResponse(res, "Lấy thông tin người dùng thành công", user);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Cập nhật thông tin người dùng
 * @access  Private - Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const user = await userService.updateUser(id, updateData);

    return successResponse(res, "Cập nhật thông tin thành công", user);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id/status
 * @desc    Khóa/mở khóa tài khoản
 * @access  Private - Admin
 */
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await userService.toggleUserStatus(id, status);

    return successResponse(res, "Cập nhật trạng thái thành công", user);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa người dùng
 * @access  Private - Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await userService.deleteUser(id);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/stats
 * @desc    Thống kê người dùng
 * @access  Private - Admin
 */
exports.getUserStats = async (req, res, next) => {
  try {
    const stats = await userService.getUserStats();

    return successResponse(res, "Lấy thống kê thành công", stats);
  } catch (error) {
    next(error);
  }
};

exports.exportUsersToExcel = async (req, res, next) => {
  try {
    const data = await exportService.exportUsersToExcel();

    // Set headers for Excel file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.filename}"`,
    );
    res.setHeader("X-Total-Records", data.totalRecords);

    // Send buffer directly
    return res.send(data.buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users/test-email
 * @desc    Test email configuration
 * @access  Private - Admin
 */
exports.testEmailConfig = async (req, res, next) => {
  try {
    const { testEmail } = req.body;

    // Kiểm tra cấu hình email
    const configTest = await emailService.testEmailConfiguration();

    if (!configTest.success) {
      return res.status(400).json({
        success: false,
        message: "Email configuration error",
        error: configTest.message,
      });
    }

    // Gửi email test nếu có testEmail
    if (testEmail) {
      await emailService.sendWelcomeEmail(testEmail, "Test User");
      return successResponse(res, "Email sent successfully to " + testEmail);
    }

    return successResponse(res, "Email configuration is valid", configTest);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/email-config
 * @desc    Get email configuration
 * @access  Private - Admin
 */
exports.getEmailConfig = async (req, res, next) => {
  try {
    const emailConfigs = await SystemConfig.find({
      category: "email",
      isActive: true,
    }).select("key value description");

    return successResponse(res, "Get email config successfully", emailConfigs);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/email-config
 * @desc    Update email configuration
 * @access  Private - Admin
 */
exports.updateEmailConfig = async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, key2: value2, ... }

    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const config = await SystemConfig.findOneAndUpdate(
        { key: key, category: "email" },
        { value: value, updatedBy: req.user._id },
        { new: true },
      );
      if (config) {
        results.push(config);
      }
    }

    return successResponse(res, "Email config updated successfully", results);
  } catch (error) {
    next(error);
  }
};
