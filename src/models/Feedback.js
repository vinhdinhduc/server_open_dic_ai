const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    type: {
      type: String,
      enum: ["feedback", "bug", "feature", "other"],
      default: "feedback",
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
    adminNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

feedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
