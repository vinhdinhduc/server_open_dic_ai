const mongoose = require("mongoose");

/**
 * Điểm Uy Tín (ĐUT) - Reputation Point Model
 * Lưu trữ lịch sử từng lần cộng/trừ điểm
 */
const reputationHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        // Đóng góp thuật ngữ mới
        "term_submitted",
        "term_approved",
        "term_rejected_valid",
        "term_rejected_spam",
        "term_view_milestone",
        "term_favorite_milestone",
        "term_monthly_usage",
        // Gợi ý chỉnh sửa
        "edit_submitted",
        "edit_approved",
        "edit_rejected_valid",
        "edit_rejected_sabotage",
        "edit_duplicate",
        "edit_target_compensation",
        // Báo xấu (report)
        "report_approved_incorrect",
        "report_approved_spam",
        "report_approved_inappropriate",
        "report_approved_duplicate",
        "report_approved_other",
        "report_rejected_incorrect",
        "report_rejected_spam",
        "report_rejected_inappropriate",
        "report_rejected_duplicate",
        "report_rejected_other",
        // Hệ thống
        "streak_bonus",
        "inactivity_decay",
        "anti_fraud_penalty",
        "admin_adjustment",
        // Đổi quà
        "redemption_training_points",
        "redemption_special_training",
      ],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ["contribution", "report", "bonus", "penalty", "redemption"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ["Term", "Contribution", "Report", "Comment", null],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

reputationHistorySchema.index({ user: 1, createdAt: -1 });
reputationHistorySchema.index({ user: 1, action: 1, createdAt: -1 });
reputationHistorySchema.index({ user: 1, category: 1 });

/**
 * Tổng hợp điểm uy tín của user
 */
const reputationSummarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // Tổng điểm uy tín hiện tại
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Điểm theo từng danh mục (trước khi tính trọng số)
    contributionPoints: {
      type: Number,
      default: 0,
    },
    reportPoints: {
      type: Number,
      default: 0,
    },
    bonusPoints: {
      type: Number,
      default: 0,
    },
    penaltyPoints: {
      type: Number,
      default: 0,
    },
    // Mức uy tín hiện tại (1-5)
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    // Streak
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastActivityDate: {
      type: Date,
      default: null,
    },
    // Báo xấu stats
    totalReports: {
      type: Number,
      default: 0,
    },
    approvedReports: {
      type: Number,
      default: 0,
    },
    // Điểm hôm nay (để kiểm tra giới hạn)
    dailyContributionPoints: {
      type: Number,
      default: 0,
    },
    dailyReportPoints: {
      type: Number,
      default: 0,
    },
    dailyPointsDate: {
      type: String,
      default: "",
    },
    // Sinh viên ĐHTB
    isUtbStudent: {
      type: Boolean,
      default: false,
    },
    totalRedeemedTrainingPoints: {
      type: Number,
      default: 0,
    },
    // Badge
    badges: [
      {
        type: String,
        enum: [
          "top_contributor",
          "trusted_reporter",
          "streak_7",
          "streak_30",
          "level_2",
          "level_3",
          "level_4",
          "level_5",
          "utb_verified",
        ],
      },
    ],
  },
  { timestamps: true },
);

reputationSummarySchema.index({ totalPoints: -1 });
reputationSummarySchema.index({ level: 1 });
reputationSummarySchema.index({ user: 1 }, { unique: true });

/**
 * Yêu cầu đổi quà / điểm rèn luyện
 */
const redemptionRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["training_points", "special_training"],
      required: true,
    },
    pointsUsed: {
      type: Number,
      required: true,
    },
    trainingPointsGained: {
      type: Number,
      required: true,
    },
    semester: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    studentId: { type: String, trim: true }, // MSSV
    studentClass: { type: String, trim: true }, // Lớp
    faculty: { type: String, trim: true }, // Khoa
    phone: { type: String, trim: true }, // Số điện thoại

    certificateNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Đường dẫn file PDF giấy xác nhận
    pdfPath: { type: String },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true },
);

redemptionRequestSchema.index({ user: 1, status: 1 });
redemptionRequestSchema.index({ certificateNumber: 1 });

const ReputationHistory = mongoose.model(
  "ReputationHistory",
  reputationHistorySchema,
);
const ReputationSummary = mongoose.model(
  "ReputationSummary",
  reputationSummarySchema,
);
const RedemptionRequest = mongoose.model(
  "RedemptionRequest",
  redemptionRequestSchema,
);

module.exports = {
  ReputationHistory,
  ReputationSummary,
  RedemptionRequest,
};
