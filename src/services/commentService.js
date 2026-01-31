const Comment = require("../models/Comment");
const Term = require("../models/Term");
const Notification = require("../models/Notification");
const { COMMENT_STATUS, USER_ROLES } = require("../utils/constants");

exports.createComment = async (commentData, userId) => {
  const { termId, content, parentCommentId } = commentData;
  //Check term có tồn tại không
  const term = await Term.findById(termId);
  if (!term) {
    const error = new Error("Thuật ngữ không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  //Tạo comment

  const newComment = Comment.create({
    term: termId,
    author: userId,
    content,
    commentParent: parentComment || null,
    status: COMMENT_STATUS.PENDING,
  });

  //Tăng comment count cho term
  term.commentCount += 1;
  await term.save();

  //Nếu có reply gửi comment cho

  if (parentComment) {
    const parentCommentDoc = await Comment.findById(parentComment);
    if (parentCommentDoc && parentCommentDoc.author.toString() !== userId) {
      await Notification.create({
        recipient: parentCommentDoc.author,
        type: "COMMENT_REPLY",
        title: "Có người trả lời bình luận của bạn",
        message: `Bình luận của bạn đã được trả lời.`,
        relatedId: newComment._id,
        relatedModel: "Comment",
      });
    }
  }
  await newComment.populate("author", "fullName");
  return newComment;
};
// Lấy bình luận của thuật ngữ

exports.getCommentsByTerm = async (termId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  // Lấy comment cha

  const [comments, total] = await Promise.all([
    Comment.find({
      term: termId,
      parentComment: null,
      status: COMMENT_STATUS.APPROVED,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "fullName")
      .lean(),

    Comment.countDocuments({
      term: termId,
      parentComment: null,
      status: COMMENT_STATUS.APPROVED,
    }),
  ]);

  //Lấy replies cho từng comment cha

  for (let comment of comments) {
    const replies = await Comment.find({
      parentComment: comment._id,
      status: COMMENT_STATUS.APPROVED,
    })
      .sort({ createdAt: 1 })
      .populate("author", "fullName")
      .lean();

    comment.replies = replies;
  }
  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

//Cập nhật bình luận

exports.updateComment = async (commentId, userId, content) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error("Bình luận không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  //Just author updated

  if (comment.author.toString() !== userId.toString()) {
    const error = new Error("Bạn không có quyền sửa bình luận này");
    error.statusCode = 403;
    throw error;
  }

  comment.content = content;
  await comment.save();
  return comment;
};
// Xoá bình luận

exports.deleteComment = async (commentId, userId, userRole) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    const error = new Error("Bình luận không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  //Chỉ author hoặc admin
  const isOwn = comment.author.toString() === userId.toString();
  const isModerator = ["admin", "moderator"].includes(userRole);

  if (!isOwn && !isModerator) {
    const error = new Error("Bạn không có quyền xoá bình luận này");
    error.statusCode = 403;
    throw error;
  }

  //Giảm comement count của term
  const term = await Term.findById(comment.term, {
    $inc: { commentCount: -1 },
  });

  //Xoá comment và các replies

  await Comment.deleteMany({
    $or: [{ _id: commentId }, { parentComment: commentId }],
  });

  return {
    message: "Xoá bình luận thành công",
  };
};

//Kiểm duyệt bình luận

exports.moderateComment = async (
  commentId,
  status,
  moderatorId,
  moderatorNote = "",
  user = null,
) => {
  const comment = await Comment.findById(commentId).populate("term");
  if (!comment) {
    const error = new Error("Không tìm thấy bình luận");
    error.statusCode = 404;
    throw error;
  }

  // Lấy category của term để kiểm tra quyền
  const term = await Term.findById(comment.term);
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ liên quan");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền category cho moderator
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) => cat.toString() === term.category.toString(),
    );
    if (!isAllowed) {
      const error = new Error(
        "Bạn không có quyền kiểm duyệt bình luận trong danh mục này",
      );
      error.statusCode = 403;
      throw error;
    }
  }

  comment.status = status;
  comment.moderator = moderatorId;
  comment.moderatorNote = moderatorNote;
  await comment.save();

  return comment;
};
