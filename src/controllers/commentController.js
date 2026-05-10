const { successResponse } = require("../utils/response");
const commentService = require("../services/commentService");
const { logAudit, ACTIONS } = require("../services/auditLogService");

/**
 * @route   GET /api/comments
 * @desc    Lấy tất cả bình luận cho admin
 * @access  Private - Moderator/Admin
 */
exports.getAllComments = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 20 };
    const { status, search } = req.query;

    const result = await commentService.getAllComments(
      {
        page,
        limit,
        status,
        search,
      },
      req.user,
    );

    return successResponse(res, "Lấy danh sách bình luận thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/comments
 * @desc    Tạo bình luận mới
 * @access  Private
 */
exports.createComment = async (req, res, next) => {
  try {
    const termId = req.body.term || req.body.termId;
    const { content, parentComment } = req.body;
    const userId = req.user._id;

    const comment = await commentService.createComment(
      { termId, content, parentCommentId: parentComment },
      userId,
    );

    return successResponse(res, "Tạo bình luận thành công", comment, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/comments/term/:termId
 * @desc    Lấy bình luận của thuật ngữ
 * @access  Public
 */
exports.getCommentsByTerm = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const { page, limit } = req.pagination;

    const result = await commentService.getCommentsByTerm(termId, {
      page,
      limit,
    });

    return successResponse(res, "Lấy bình luận thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/comments/:id
 * @desc    Cập nhật bình luận
 * @access  Private - Owner
 */
exports.updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const comment = await commentService.updateComment(id, userId, content);

    return successResponse(res, "Cập nhật bình luận thành công", comment);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/comments/:id
 * @desc    Xóa bình luận
 * @access  Private - Owner/Moderator/Admin
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const result = await commentService.deleteComment(id, userId, userRole);

    try {
      logAudit({
        action: ACTIONS.COMMENT_DELETE,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          fullName: req.user?.fullName,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "comment",
          resourceId: id,
          resourceName: null,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore audit failure */
    }

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/comments/:id/moderate
 * @desc    Kiểm duyệt bình luận
 * @access  Private - Moderator/Admin
 */
exports.moderateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, moderatorNote } = req.body;
    const moderatorId = req.user._id;

    const comment = await commentService.moderateComment(
      id,
      status,
      moderatorId,
      moderatorNote,
      req.user, // Truyền user để kiểm tra quyền category
    );

    try {
      logAudit({
        action:
          status === "approved"
            ? ACTIONS.COMMENT_APPROVE
            : ACTIONS.COMMENT_REJECT,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          fullName: req.user?.fullName,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "comment",
          resourceId: id,
          resourceName: comment?.content ? comment.content.slice(0, 120) : null,
        },
        diff: {
          before: null,
          after: { status, moderatorNote: moderatorNote || null },
        },
        reason: moderatorNote || null,
      });
    } catch (e) {
      /* ignore audit failure */
    }

    return successResponse(res, "Kiểm duyệt thành công", comment);
  } catch (error) {
    next(error);
  }
};
