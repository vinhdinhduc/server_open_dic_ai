const Comment = require("../models/Comment");
const Term = require("../models/Term");
const Notification = require("../models/Notification");
const User = require("../models/User");
const emailService = require("./emailService");
const notificationService = require("./notificationService");
const {
  COMMENT_STATUS,
  USER_ROLES,
  NOTIFICATION_TYPES,
} = require("../utils/constants");

/**
 * Lấy tất cả bình luận cho admin/moderator
 * Moderator chỉ xem bình luận trong danh mục được phân công
 * @param {Object} options - Các tùy chọn lọc và phân trang
 * @param {Object} user - User hiện tại (để check quyền moderator)
 * @returns {Object} Danh sách bình luận và thông tin phân trang
 */
exports.getAllComments = async (options = {}, user = null) => {
  const { page = 1, limit = 20, status, search } = options;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (search) {
    query.content = { $regex: search, $options: "i" };
  }

  // Nếu là moderator, chỉ lấy bình luận trong danh mục được phép
  let termFilter = null;
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    if (allowedCategories.length === 0) {
      return {
        comments: [],
        stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
        pagination: { page, limit, total: 0, pages: 0 },
      };
    }
    // Tìm termIds thuộc danh mục được phép
    const allowedTerms = await Term.find({
      category: { $in: allowedCategories },
    }).select("_id");
    const termIds = allowedTerms.map((t) => t._id);
    query.term = { $in: termIds };
  }

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "fullName email avatar")
      .populate("moderator", "fullName")
      .populate({
        path: "term",
        select: "term category",
        populate: { path: "category", select: "name" },
      })
      .lean(),
    Comment.countDocuments(query),
  ]);

  // Count by status (cũng theo filter category nếu là moderator)
  const baseQuery =
    user && user.role === USER_ROLES.MODERATOR && query.term
      ? { term: query.term }
      : {};
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    Comment.countDocuments({ ...baseQuery, status: COMMENT_STATUS.PENDING }),
    Comment.countDocuments({ ...baseQuery, status: COMMENT_STATUS.APPROVED }),
    Comment.countDocuments({ ...baseQuery, status: COMMENT_STATUS.REJECTED }),
  ]);

  return {
    comments,
    stats: {
      total,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

exports.createComment = async (commentData, userId) => {
  const { termId, content, parentCommentId } = commentData;
  //Check term có tồn tại không
  const term = await Term.findById(termId).populate("category", "name");
  if (!term) {
    const error = new Error("Thuật ngữ không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  //Tạo comment

  const newComment = await Comment.create({
    term: termId,
    author: userId,
    content,
    parentComment: parentCommentId || null,
    status: COMMENT_STATUS.PENDING,
  });

  //Tăng comment count cho term
  term.commentCount += 1;
  await term.save();

  //Nếu có reply gửi notification cho tác giả comment cha
  if (parentCommentId) {
    const parentCommentDoc = await Comment.findById(parentCommentId);
    if (parentCommentDoc && parentCommentDoc.author.toString() !== userId) {
      await Notification.create({
        recipient: parentCommentDoc.author,
        type: NOTIFICATION_TYPES.COMMENT_REPLY,
        title: "Có người trả lời bình luận của bạn",
        message: `Bình luận của bạn đã được trả lời.`,
        relatedId: newComment._id,
        relatedModel: "Comment",
        actionUrl: `/terms/${termId}`,
      });
    }
  }

  // Gửi thông báo cho moderator/admin về bình luận mới cần kiểm duyệt
  notificationService
    .notifyModeratorsForCategory(term.category._id || term.category, {
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "Bình luận mới cần kiểm duyệt",
      message: `Có bình luận mới cho thuật ngữ "${term.term?.vi || ""}" cần được kiểm duyệt.`,
      relatedId: newComment._id,
      relatedModel: "Comment",
      actionUrl: "/admin/comments",
    })
    .catch((err) => {
      console.error("Failed to notify moderators about new comment:", err);
    });

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
  const term = await Term.findByIdAndUpdate(comment.term, {
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
  const term = await Term.findById(comment.term).populate("category", "name");
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ liên quan");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền category cho moderator
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) => cat.toString() === term.category._id.toString(),
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

  // Gửi thông báo cho tác giả bình luận
  const statusText =
    status === COMMENT_STATUS.APPROVED ? "được duyệt" : "bị từ chối";
  await Notification.create({
    recipient: comment.author,
    type: NOTIFICATION_TYPES.COMMENT_MODERATED,
    title: `Bình luận đã ${statusText}`,
    message: `Bình luận của bạn trong thuật ngữ "${term.term?.vi || ""}" đã ${statusText}.${moderatorNote ? ` Ghi chú: ${moderatorNote}` : ""}`,
    relatedId: comment._id,
    relatedModel: "Comment",
    actionUrl: `/terms/${term._id}`,
  });

  // Gửi email cho tác giả bình luận
  const authorInfo = await User.findById(comment.author).select(
    "fullName email",
  );
  if (authorInfo) {
    emailService
      .sendCommentModeratedEmail(authorInfo.email, authorInfo.fullName, {
        status,
        termName: term.term?.vi || "",
        moderatorNote,
        commentContent: comment.content,
      })
      .catch((err) => {
        console.error("Failed to send comment moderation email:", err);
      });
  }

  return comment;
};
