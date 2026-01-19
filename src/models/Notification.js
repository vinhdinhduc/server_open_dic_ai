const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
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
      "comment_reply",
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
    enum: ["Contribution", "Comment", "Term", null],
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
