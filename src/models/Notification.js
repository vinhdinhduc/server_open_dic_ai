const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "contribution_approved",
        "contribution_rejected",
        "contribution_new",
        "comment_reply",
        "comment_moderated",
        "report_resolved",
        "report_rejected",
        "report_new",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ["Contribution", "Comment", "Term", "Report", null],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // Link để điều hướng khi click vào thông báo
    actionUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index cho query nhanh
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
