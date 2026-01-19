const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["general", "email", "ai", "moderation", "security"],
      default: "general",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

systemConfigSchema.index({ key: 1 });
systemConfigSchema.index({ category: 1, isActive: 1 });

// Method để lấy giá trị config dễ dàng
systemConfigSchema.statics.getValue = async function (
  key,
  defaultValue = null
) {
  const config = await this.findOne({ key, isActive: true });
  return config ? config.value : defaultValue;
};

// Method để set giá trị config
systemConfigSchema.statics.setValue = async function (
  key,
  value,
  userId = null
) {
  return await this.findOneAndUpdate(
    { key },
    {
      value,
      updatedBy: userId,
      updatedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
    }
  );
};

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
