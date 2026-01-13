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
  },
  {
    timestamps: true,
  }
);

// Đảm bảo một user chỉ có thể favorite một term một lần
favoriteSchema.index({ user: 1, term: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);
