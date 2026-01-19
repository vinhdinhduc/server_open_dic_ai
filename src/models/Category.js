const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      vi: { type: String, required: true },
      lo: String,
      en: String,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      vi: String,
      lo: String,
      en: String,
    },
    icon: String,
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    termCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model("Category", categorySchema);
