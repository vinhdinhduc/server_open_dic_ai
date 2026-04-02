const { successResponse } = require("../utils/response");
const userService = require("../services/userService");
const exportService = require("../services/exportService");
const emailService = require("../services/emailService");
const SystemConfig = require("../models/SystemConfig");

// ─────────────────────────────────────────────────────────────────────────────
// USER CRUD
// ─────────────────────────────────────────────────────────────────────────────

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
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.filename}"`,
    );
    res.setHeader("X-Total-Records", data.totalRecords);
    return res.send(data.buffer);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SMTP CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/users/test-email
 * @desc    Test email configuration
 * @access  Private - Admin
 */
exports.testEmailConfig = async (req, res, next) => {
  try {
    const { testEmail } = req.body;
    const configTest = await emailService.testEmailConfiguration();

    if (!configTest.success) {
      return res.status(400).json({
        success: false,
        message: "Email configuration error",
        error: configTest.message,
      });
    }

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
 * @desc    Get email SMTP configuration
 * @access  Private - Admin
 */
exports.getEmailConfig = async (req, res, next) => {
  try {
    const emailConfigs = await SystemConfig.find({
      category: "email",
      isActive: true,
      // Exclude template keys from SMTP config view
      key: { $not: /^email_template_/ },
    }).select("key value description");

    return successResponse(res, "Get email config successfully", emailConfigs);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/email-config
 * @desc    Update email SMTP configuration
 * @access  Private - Admin
 */
exports.updateEmailConfig = async (req, res, next) => {
  try {
    const updates = req.body;
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
      const config = await SystemConfig.findOneAndUpdate(
        { key, category: "email" },
        { value, updatedBy: req.user._id },
        { new: true },
      );
      if (config) results.push(config);
    }

    return successResponse(res, "Email config updated successfully", results);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/users/email-templates
 * @desc    Lấy tất cả email templates (merged default + DB override)
 * @access  Private - Admin
 */
exports.getEmailTemplates = async (req, res, next) => {
  try {
    const defaults = emailService.EMAIL_TEMPLATE_DEFAULTS;

    // Lấy tất cả templates đã được lưu trong DB
    const dbTemplates = await SystemConfig.find({
      key: { $regex: /^email_template_/ },
      category: "email",
      isActive: true,
    }).select("key value");

    // Index DB templates theo key ngắn (bỏ prefix "email_template_")
    const dbMap = {};
    dbTemplates.forEach((item) => {
      const shortKey = item.key.replace("email_template_", "");
      dbMap[shortKey] = item.value;
    });

    // Gộp: mỗi template trả về { key, label, default, db, merged, isCustomized }
    const TEMPLATE_META = getTemplateMetadata();
    const templates = TEMPLATE_META.map((meta) => {
      const defaultVal = defaults[meta.key] || {};
      const dbVal = dbMap[meta.key] || null;
      return {
        key: meta.key,
        label: meta.label,
        description: meta.description,
        variables: meta.variables,
        fields: meta.fields,
        default: defaultVal,
        db: dbVal,
        // merged = default + DB override (same logic as getEmailTemplate())
        merged: dbVal ? { ...defaultVal, ...dbVal } : { ...defaultVal },
        isCustomized: !!dbVal,
      };
    });

    return successResponse(res, "Get email templates successfully", templates);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/email-templates/:key
 * @desc    Cập nhật một email template vào DB
 * @access  Private - Admin
 */
exports.updateEmailTemplate = async (req, res, next) => {
  try {
    const { key } = req.params;
    const templateData = req.body; // { subject, title, accentColor, intro, ctaLabel?, warningHtml? }

    // Validate key hợp lệ
    const validKeys = Object.keys(emailService.EMAIL_TEMPLATE_DEFAULTS);
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Template key không hợp lệ: ${key}. Các key hợp lệ: ${validKeys.join(", ")}`,
      });
    }

    // Chỉ cho phép các field hợp lệ
    const allowedFields = [
      "subject",
      "title",
      "accentColor",
      "intro",
      "ctaLabel",
      "warningHtml",
    ];
    const sanitized = {};
    for (const field of allowedFields) {
      if (templateData[field] !== undefined) {
        sanitized[field] = templateData[field];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có field hợp lệ nào được cung cấp",
      });
    }

    if (
      sanitized.accentColor !== undefined &&
      !/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(sanitized.accentColor)
    ) {
      return res.status(400).json({
        success: false,
        message: "accentColor phải là mã màu hợp lệ, ví dụ #2563eb",
      });
    }

    const existingConfig = await SystemConfig.findOne({
      key: `email_template_${key}`,
      category: "email",
    })
      .select("value")
      .lean();

    const mergedValue = {
      ...(existingConfig?.value || {}),
      ...sanitized,
    };

    const config = await SystemConfig.findOneAndUpdate(
      { key: `email_template_${key}`, category: "email" },
      {
        value: mergedValue,
        updatedBy: req.user._id,
        description: `Email template: ${key}`,
        isActive: true,
      },
      { upsert: true, new: true },
    );

    return successResponse(res, "Email template updated successfully", config);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/email-templates/:key
 * @desc    Reset template về mặc định (xóa override trong DB)
 * @access  Private - Admin
 */
exports.resetEmailTemplate = async (req, res, next) => {
  try {
    const { key } = req.params;

    const validKeys = Object.keys(emailService.EMAIL_TEMPLATE_DEFAULTS);
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Template key không hợp lệ: ${key}`,
      });
    }

    await SystemConfig.deleteOne({
      key: `email_template_${key}`,
      category: "email",
    });

    const defaultVal = emailService.EMAIL_TEMPLATE_DEFAULTS[key];
    return successResponse(res, "Template đã được reset về mặc định", {
      key,
      default: defaultVal,
      isCustomized: false,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTHER USER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Admin reset password for user
 * @access  Private - Admin
 */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await userService.resetUserPassword(id, newPassword);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users/:id/resend-verification
 * @desc    Admin resend verification email for user
 * @access  Private - Admin
 */
exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await userService.resendVerificationEmail(id);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users/batch-update-status
 * @desc    Batch update user status
 * @access  Private - Admin
 */
exports.batchUpdateStatus = async (req, res, next) => {
  try {
    const { userIds, status } = req.body;
    const result = await userService.batchUpdateStatus(userIds, status);
    return successResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id/activity
 * @desc    Get user activity history
 * @access  Private - Admin
 */
exports.getUserActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.pagination;
    const result = await userService.getUserActivity(id, { page, limit });
    return successResponse(res, "Lấy lịch sử hoạt động thành công", result);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Metadata của từng template (fields, variables, labels)
// ─────────────────────────────────────────────────────────────────────────────
function getTemplateMetadata() {
  return [
    {
      key: "verification",
      label: "Xác thực tài khoản",
      description: "Gửi khi người dùng đăng ký và cần xác thực email",
      variables: ["{{userName}}", "{{verificationUrl}}"],
      fields: [
        "subject",
        "title",
        "accentColor",
        "intro",
        "ctaLabel",
        "warningHtml",
      ],
    },
    {
      key: "welcome",
      label: "Chào mừng người dùng",
      description: "Gửi sau khi người dùng xác thực email thành công",
      variables: ["{{userName}}"],
      fields: ["subject", "title", "accentColor", "intro", "ctaLabel"],
    },
    {
      key: "password_reset",
      label: "Đặt lại mật khẩu",
      description: "Gửi khi người dùng yêu cầu đặt lại mật khẩu",
      variables: ["{{userName}}", "{{resetUrl}}"],
      fields: [
        "subject",
        "title",
        "accentColor",
        "intro",
        "ctaLabel",
        "warningHtml",
      ],
    },
    {
      key: "contribution_approved",
      label: "Đóng góp được phê duyệt",
      description:
        "Gửi khi đóng góp của người dùng được admin/moderator phê duyệt",
      variables: ["{{userName}}", "{{termName}}", "{{moderatorNote}}"],
      fields: ["subject", "title", "accentColor", "intro"],
    },
    {
      key: "contribution_rejected",
      label: "Đóng góp bị từ chối",
      description: "Gửi khi đóng góp của người dùng bị admin/moderator từ chối",
      variables: ["{{userName}}", "{{termName}}", "{{moderatorNote}}"],
      fields: ["subject", "title", "accentColor", "intro"],
    },
    {
      key: "comment_moderated",
      label: "Kết quả kiểm duyệt bình luận",
      description:
        "Gửi khi bình luận được duyệt hoặc từ chối (màu accent tự động thay đổi theo kết quả)",
      variables: ["{{userName}}", "{{termName}}", "{{moderatorNote}}"],
      fields: ["subject", "title", "intro"],
    },
    {
      key: "report_resolved",
      label: "Báo cáo được xử lý",
      description: "Gửi cho người dùng khi báo cáo của họ đã được admin xử lý",
      variables: ["{{userName}}", "{{moderatorNote}}"],
      fields: ["subject", "title", "accentColor", "intro"],
    },
    {
      key: "new_contribution_admin",
      label: "Thông báo đóng góp mới (Admin)",
      description: "Gửi cho admin/moderator khi có đóng góp mới cần kiểm duyệt",
      variables: ["{{recipientName}}", "{{contributorName}}", "{{termName}}"],
      fields: ["subject", "title", "accentColor", "intro", "ctaLabel"],
    },
    {
      key: "new_report_admin",
      label: "Thông báo báo cáo mới (Admin)",
      description: "Gửi cho admin/moderator khi có báo cáo mới cần xử lý",
      variables: ["{{recipientName}}", "{{reporterName}}", "{{reportReason}}"],
      fields: ["subject", "title", "accentColor", "intro", "ctaLabel"],
    },
  ];
}
