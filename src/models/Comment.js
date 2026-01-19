const mongoose = require("mongoose");

const { COMMENT_STATUS } = require("../utils/constants");
const commentSchema = new mongoose.Schema(
  {
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Nội dung bình luận là bắt buộc"],
      trim: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    status: {
      type: String,
      enum: [
        COMMENT_STATUS.PENDING,
        COMMENT_STATUS.APPROVED,
        COMMENT_STATUS.REJECTED,
      ],
    },
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatorNote: String,
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ term: 1, status: 1 });
commentSchema.index({ author: 1 });

module.exports = mongoose.model("Comment", commentSchema);
