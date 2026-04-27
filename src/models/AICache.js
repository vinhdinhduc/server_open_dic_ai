const mongoose = require("mongoose");

const aiCacheSchema = new mongoose.Schema(
  {
    termId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },
    language: {
      type: String,
      required: true,
      enum: ["vi", "en", "lo"],
    },
    response: {
      definition: String,
      detailedExplanation: String,
      examples: [String],
      partOfSpeech: String,
      field: String,
      relatedTerms: [String],
      tags: [String],
    },
    provider: String,
    model: String,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  },
  { timestamps: true },
);

// Chỉ mục ghép để tra cứu nhanh và TTL
aiCacheSchema.index({ termId: 1, language: 1 }, { unique: true });
aiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AICache", aiCacheSchema);
