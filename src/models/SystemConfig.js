const mongoose = require("mongoose");
const {
  encrypt,
  decrypt,
  shouldEncrypt,
  isEncrypted,
} = require("../utils/encryption");

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
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook: Encrypt sensitive data before saving
systemConfigSchema.pre("save", function (next) {
  try {
    // Check if value is being modified and should be encrypted
    if (this.isModified("value") && shouldEncrypt(this.key)) {
      // Only encrypt if not already encrypted and value is string
      if (typeof this.value === "string" && !isEncrypted(this.value)) {
        this.value = encrypt(this.value);
        this.isEncrypted = true;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-findOneAndUpdate hook: Encrypt sensitive data before update
systemConfigSchema.pre("findOneAndUpdate", function (next) {
  try {
    const update = this.getUpdate();
    const key = this.getQuery().key;

    if (update.value && key && shouldEncrypt(key)) {
      // Only encrypt if not already encrypted and value is string
      if (typeof update.value === "string" && !isEncrypted(update.value)) {
        update.value = encrypt(update.value);
        update.isEncrypted = true;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Post-find hook: Decrypt sensitive data after retrieval
const decryptSensitiveData = function (doc) {
  if (doc && doc.isEncrypted && typeof doc.value === "string") {
    try {
      doc.value = decrypt(doc.value);
    } catch (error) {
      console.error(`Failed to decrypt config: ${doc.key}`, error);
    }
  }
};

systemConfigSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptSensitiveData);
  }
});

systemConfigSchema.post("findOne", function (doc) {
  decryptSensitiveData(doc);
});

systemConfigSchema.post("findOneAndUpdate", function (doc) {
  decryptSensitiveData(doc);
});

systemConfigSchema.index({ key: 1 });
systemConfigSchema.index({ category: 1, isActive: 1 });

// Method để lấy giá trị config dễ dàng
systemConfigSchema.statics.getValue = async function (
  key,
  defaultValue = null,
) {
  const config = await this.findOne({ key, isActive: true });
  return config ? config.value : defaultValue;
};

// Method để set giá trị config
systemConfigSchema.statics.setValue = async function (
  key,
  value,
  userId = null,
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
    },
  );
};

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
