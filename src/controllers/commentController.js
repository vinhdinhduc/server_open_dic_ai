// src/controllers/commentController.js
const { successResponse } = require("../utils/response");
const commentService = require("../services/commentService");

/**
 * @route   POST /api/comments
 * @desc    Tạo bình luận mới
 * @access  Private
 */
exports.createComment = async (req, res, next) => {
  try {
    const { termId, content, parentComment } = req.body;
    const userId = req.user._id;

    const comment = await commentService.createComment(
      { termId, content, parentComment },
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
    );

    return successResponse(res, "Kiểm duyệt thành công", comment);
  } catch (error) {
    next(error);
  }
};
