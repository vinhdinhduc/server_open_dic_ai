const mongoose = require("mongoose");

const contributionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["new_term", "edit_term", "report_error"],
      required: true,
    },
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

contributionSchema.index({ user: 1, status: 1 });
contributionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Contribution", contributionSchema);
