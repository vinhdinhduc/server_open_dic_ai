const mongoose = require("mongoose");
const { CONTRIBUTION_STATUS } = require("../utils/constants");

const contributionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["new_term", "edit_term"],
      required: true,
    },
    targetTerm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
    },
    term: {
      vi: { type: String, required: true },
      lo: String,
      en: String,
    },
    definition: {
      vi: { type: String, required: true },
      lo: String,
      en: String,
    },
    detailedExplanation: {
      vi: String,
      lo: String,
      en: String,
    },
    examples: [
      {
        vi: String,
        lo: String,
        en: String,
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    contributorNote: String,
    contributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        CONTRIBUTION_STATUS.PENDING,
        CONTRIBUTION_STATUS.APPROVED,
        CONTRIBUTION_STATUS.REJECTED,
      ],
      default: CONTRIBUTION_STATUS.PENDING,
    },
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatorNote: String,
    moderatedAt: Date,
  },
  {
    timestamps: true,
  }
);

contributionSchema.index({ contributor: 1, status: 1 });
contributionSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model("Contribution", contributionSchema);
