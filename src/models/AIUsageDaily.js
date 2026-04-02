const mongoose = require("mongoose");

const aiUsageDailySchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokenCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDailyRequests: {
      type: Number,
      default: 1000,
      min: 0,
    },
    maxDailyTokens: {
      type: Number,
      default: 500000,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

aiUsageDailySchema.index({ dateKey: 1 }, { unique: true });
aiUsageDailySchema.index({ date: 1 });

module.exports = mongoose.model("AIUsageDaily", aiUsageDailySchema);
