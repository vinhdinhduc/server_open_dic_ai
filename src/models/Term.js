const mongoose = require("mongoose");
const { TERM_STATUS } = require("../utils/constants");

const termSchema = new mongoose.Schema(
  {
    term: {
      vi: { type: String, required: true, trim: true },
      lo: { type: String, trim: true },
      en: { type: String, trim: true },
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
    partOfSpeech: String,
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    relatedTerms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Term",
      },
    ],
    status: {
      type: String,
      enum: [TERM_STATUS.DRAFT, TERM_STATUS.PUBLISHED],
      default: TERM_STATUS.PUBLISHED,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Text index cho full-text search
termSchema.index({
  "term.vi": "text",
  "term.lo": "text",
  "term.en": "text",
  "definition.vi": "text",
  "definition.lo": "text",
  "definition.en": "text",
});

termSchema.index({ category: 1, status: 1 });
termSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Term", termSchema);
