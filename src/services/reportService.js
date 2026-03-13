const Report = require("../models/Report");
const Term = require("../models/Term");
const Notification = require("../models/Notification");
const User = require("../models/User");
const emailService = require("./emailService");
const notificationService = require("./notificationService");
const reputationService = require("./reputationService");
const {
  REPORT_STATUS,
  REPORT_TYPES,
  USER_ROLES,
  NOTIFICATION_TYPES,
  REPORT_REASONS_LABELS,
} = require("../utils/constants");

/**
 * Tạo báo xấu mới (chỉ cho thuật ngữ)
 */
exports.createReport = async (reportData, reporterId) => {
  const { targetId, reason, description } = reportData;

  // Tìm thuật ngữ
  const term = await Term.findById(targetId);
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra đã báo xấu chưa
  const existingReport = await Report.findOne({
    reporter: reporterId,
    targetTerm: targetId,
    status: REPORT_STATUS.PENDING,
  });

  if (existingReport) {
    const error = new Error("Bạn đã báo xấu thuật ngữ này rồi");
    error.statusCode = 400;
    throw error;
  }

  const report = await Report.create({
    type: REPORT_TYPES.TERM,
    targetTerm: targetId,
    category: term.category,
    reason,
    description,
    reporter: reporterId,
    status: REPORT_STATUS.PENDING,
  });

  // Lấy thông tin người báo cáo và gửi email cho admin
  const reporter = await User.findById(reporterId).select("fullName email");

  // Gửi email thông báo cho admin (không chờ kết quả)
  emailService
    .sendNewReportNotificationToAdmins(
      {
        contentType: "term",
        reason: REPORT_REASONS_LABELS[reason] || reason,
        description: description,
      },
      reporter,
      term,
    )
    .catch((err) => {
      console.error("Failed to send report notification to admins:", err);
    });

  // Gửi thông báo in-app cho moderator/admin phụ trách danh mục
  notificationService
    .notifyModeratorsForCategory(term.category, {
      type: NOTIFICATION_TYPES.REPORT_NEW,
      title: "Báo xấu mới cần xử lý",
      message: `Có báo xấu mới cho thuật ngữ "${term.term?.vi || ""}" - Lý do: ${REPORT_REASONS_LABELS[reason] || reason}`,
      relatedId: report._id,
      relatedModel: "Report",
      actionUrl: "/admin/moderation/reports",
    })
    .catch((err) => {
      console.error("Failed to notify moderators about new report:", err);
    });

  return report;
};

/**
 * Lấy danh sách báo xấu (cho moderator/admin)
 * Moderator chỉ thấy báo xấu trong danh mục được gán
 */
exports.getReports = async (options = {}, user) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    category,
    includeDeleted = false,
    onlyDeleted = false,
  } = options;
  const skip = (page - 1) * limit;

  const query = {};

  if (onlyDeleted) {
    query.isDeleted = true;
  } else if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  // Nếu là moderator, chỉ lấy reports trong danh mục được phép
  if (user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    if (allowedCategories.length === 0) {
      return {
        reports: [],
        pagination: { page, limit, total: 0, pages: 0 },
      };
    }
    query.category = { $in: allowedCategories };
  }

  // Filter theo category cụ thể (nếu có)
  if (category) {
    query.category = category;
  }

  if (status) query.status = status;
  if (type) query.type = type;

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reporter", "fullName email")
      .populate("targetTerm", "term")
      .populate("targetComment", "content")
      .populate("category", "name")
      .populate("moderator", "fullName"),
    Report.countDocuments(query),
  ]);

  return {
    reports,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Lấy chi tiết báo xấu
 */
exports.getReportById = async (reportId, user) => {
  const report = await Report.findById(reportId)
    .populate("reporter", "fullName email")
    .populate("targetTerm")
    .populate("targetComment")
    .populate("category", "name")
    .populate("moderator", "fullName");

  if (!report || report.isDeleted) {
    const error = new Error("Không tìm thấy báo xấu");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền truy cập cho moderator
  if (user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) => cat.toString() === report.category._id.toString(),
    );
    if (!isAllowed) {
      const error = new Error("Bạn không có quyền xem báo xấu này");
      error.statusCode = 403;
      throw error;
    }
  }

  return report;
};

/**
 * Xử lý báo xấu (resolve/reject)
 */
exports.resolveReport = async (
  reportId,
  moderatorId,
  resolveData,
  user = null,
) => {
  const { status, moderatorNote, actionTaken } = resolveData;

  const report = await Report.findById(reportId);
  if (!report || report.isDeleted) {
    const error = new Error("Không tìm thấy báo xấu");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền category cho moderator
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) =>
        cat.toString() ===
        (report.category?._id || report.category)?.toString(),
    );
    if (!isAllowed) {
      const error = new Error(
        "Bạn không có quyền xử lý báo xấu trong danh mục này",
      );
      error.statusCode = 403;
      throw error;
    }
  }

  if (report.status !== REPORT_STATUS.PENDING) {
    const error = new Error("Báo xấu đã được xử lý");
    error.statusCode = 400;
    throw error;
  }

  report.status = status;
  report.moderator = moderatorId;
  report.moderatorNote = moderatorNote;
  report.actionTaken = actionTaken || "none";
  report.resolvedAt = new Date();

  await report.save();

  // Gửi thông báo cho người báo xấu
  await Notification.create({
    recipient: report.reporter,
    type:
      status === REPORT_STATUS.RESOLVED
        ? NOTIFICATION_TYPES.REPORT_RESOLVED
        : NOTIFICATION_TYPES.REPORT_REJECTED,
    title: "Báo xấu đã được xử lý",
    message: `Báo xấu của bạn đã được ${status === REPORT_STATUS.RESOLVED ? "chấp nhận" : "từ chối"}.${moderatorNote ? " Ghi chú: " + moderatorNote : ""}`,
    relatedId: reportId,
    relatedModel: "Report",
    actionUrl: report.targetTerm ? `/terms/${report.targetTerm}` : null,
  });

  // Lấy thông tin người báo cáo và gửi email
  const reporterInfo = await User.findById(report.reporter).select(
    "fullName email",
  );
  if (reporterInfo) {
    emailService
      .sendReportResolvedEmail(reporterInfo.email, reporterInfo.fullName, {
        status: status,
        moderatorNote: moderatorNote,
      })
      .catch((err) => {
        console.error("Failed to send report resolved email:", err);
      });
  }

  // Cộng/trừ điểm uy tín cho người báo xấu
  const reason = report.reason || "other";
  if (status === REPORT_STATUS.RESOLVED) {
    reputationService
      .onReportResolved(report.reporter, report._id, reason)
      .catch(console.error);
  } else if (status === REPORT_STATUS.REJECTED) {
    reputationService
      .onReportRejected(report.reporter, report._id, reason)
      .catch(console.error);
  }

  return report;
};

/**
 * Thống kê báo xấu cho moderator dashboard
 */
exports.getReportStats = async (user) => {
  const matchQuery = {};

  matchQuery.isDeleted = { $ne: true };

  // Moderator chỉ thấy stats trong danh mục được phép
  if (user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    matchQuery.category = { $in: allowedCategories };
  }

  const stats = await Report.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    pending: 0,
    resolved: 0,
    rejected: 0,
    total: 0,
  };

  stats.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
};

exports.softDeleteReport = async (reportId, deletedBy = null) => {
  const report = await Report.findById(reportId);
  if (!report || report.isDeleted) {
    const error = new Error("Không tìm thấy báo xấu");
    error.statusCode = 404;
    throw error;
  }

  report.isDeleted = true;
  report.deletedAt = new Date();
  report.deletedBy = deletedBy;
  await report.save();

  return report;
};

exports.restoreReport = async (reportId) => {
  const report = await Report.findById(reportId);
  if (!report || !report.isDeleted) {
    const error = new Error("Không tìm thấy báo xấu trong thùng rác");
    error.statusCode = 404;
    throw error;
  }

  report.isDeleted = false;
  report.deletedAt = null;
  report.deletedBy = null;
  await report.save();

  return report;
};

exports.emptyReportTrash = async () => {
  const result = await Report.deleteMany({ isDeleted: true });
  return { deletedCount: result.deletedCount || 0 };
};
