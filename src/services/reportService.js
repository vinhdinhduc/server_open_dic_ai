const Report = require("../models/Report");
const Term = require("../models/Term");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const {
  REPORT_STATUS,
  REPORT_TYPES,
  USER_ROLES,
} = require("../utils/constants");

/**
 * Tạo báo xấu mới
 */
exports.createReport = async (reportData, reporterId) => {
  const { type, targetId, reason, description } = reportData;

  let category;
  let targetTerm = null;
  let targetComment = null;

  if (type === REPORT_TYPES.TERM) {
    const term = await Term.findById(targetId);
    if (!term) {
      const error = new Error("Không tìm thấy thuật ngữ");
      error.statusCode = 404;
      throw error;
    }
    category = term.category;
    targetTerm = targetId;
  } else if (type === REPORT_TYPES.COMMENT) {
    const comment = await Comment.findById(targetId).populate("term");
    if (!comment) {
      const error = new Error("Không tìm thấy bình luận");
      error.statusCode = 404;
      throw error;
    }
    // Lấy category từ term của comment
    const term = await Term.findById(comment.term);
    category = term.category;
    targetComment = targetId;
  }

  // Kiểm tra đã báo xấu chưa
  const existingReport = await Report.findOne({
    reporter: reporterId,
    ...(targetTerm && { targetTerm }),
    ...(targetComment && { targetComment }),
    status: REPORT_STATUS.PENDING,
  });

  if (existingReport) {
    const error = new Error("Bạn đã báo xấu nội dung này rồi");
    error.statusCode = 400;
    throw error;
  }

  const report = await Report.create({
    type,
    targetTerm,
    targetComment,
    category,
    reason,
    description,
    reporter: reporterId,
    status: REPORT_STATUS.PENDING,
  });

  return report;
};

/**
 * Lấy danh sách báo xấu (cho moderator/admin)
 * Moderator chỉ thấy báo xấu trong danh mục được gán
 */
exports.getReports = async (options = {}, user) => {
  const { page = 1, limit = 20, status, type, category } = options;
  const skip = (page - 1) * limit;

  const query = {};

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

  if (!report) {
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
exports.resolveReport = async (reportId, moderatorId, resolveData) => {
  const { status, moderatorNote, actionTaken } = resolveData;

  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error("Không tìm thấy báo xấu");
    error.statusCode = 404;
    throw error;
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
    type: "report_resolved",
    title: "Báo xấu đã được xử lý",
    message: `Báo xấu của bạn đã được ${status === REPORT_STATUS.RESOLVED ? "chấp nhận" : "từ chối"}`,
    relatedReport: reportId,
  });

  return report;
};

/**
 * Thống kê báo xấu cho moderator dashboard
 */
exports.getReportStats = async (user) => {
  const matchQuery = {};

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
