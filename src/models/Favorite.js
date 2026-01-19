const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },
    note: String,
  },
  {
    timestamps: true,
  }
);
// Compound index: một user không thể lưu cùng một term 2 lần
favoriteSchema.index({ user: 1, term: 1 }, { unique: true });
module.exports = mongoose.model("Favorite", favoriteSchema);
