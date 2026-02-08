const mongoose = require("mongoose");
const {
  REPORT_STATUS,
  REPORT_REASONS,
  REPORT_TYPES,
} = require("../utils/constants");

const reportSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(REPORT_TYPES),
      required: true,
      default: "term",
    },

    targetTerm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
    },

    targetComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    reason: {
      type: String,
      enum: Object.values(REPORT_REASONS),
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    // Người báo xấu
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Trạng thái xử lý
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.PENDING,
    },
    // Người kiểm duyệt xử lý
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Ghi chú của moderator
    moderatorNote: {
      type: String,
      trim: true,
    },
    // Hành động đã thực hiện
    actionTaken: {
      type: String,
      enum: ["none", "warning", "edit", "delete", "ban_user"],
    },
    // Thời gian xử lý
    resolvedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Index để query nhanh theo category và status (cho moderator)
reportSchema.index({ category: 1, status: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ targetTerm: 1 });
reportSchema.index({ targetComment: 1 });

module.exports = mongoose.model("Report", reportSchema);
