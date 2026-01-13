const mongoose = require("mongoose");

const termSchema = new mongoose.Schema(
  {
    term: {
      type: String,
      required: [true, "Vui lòng nhập thuật ngữ"],
      trim: true,
      index: true,
    },
    definition: {
      type: String,
      required: [true, "Vui lòng nhập định nghĩa"],
    },
    pronunciation: {
      type: String,
      trim: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    examples: [
      {
        text: String,
        translation: String,
      },
    ],
    synonyms: [String],
    antonyms: [String],
    relatedTerms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Term",
      },
    ],
    source: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index cho tìm kiếm
termSchema.index({ term: "text", definition: "text" });
termSchema.index({ categories: 1 });
termSchema.index({ status: 1 });

module.exports = mongoose.model("Term", termSchema);
