const express = require("express");
const commentController = require("../controllers/commentController");
const { authenticate } = require("../middlewares/auth");
const { checkModeratorPermission } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { commentValidators } = require("../validators");
const { MODERATION_PERMISSIONS } = require("../utils/constants");

const router = express.Router();

/**
 * @route   POST /api/comments
 * @desc    Tạo bình luận
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  commentValidators.create,
  validate,
  commentController.createComment,
);

/**
 * @route   GET /api/comments/term/:termId
 * @desc    Lấy bình luận của thuật ngữ
 * @access  Public
 */
router.get(
  "/term/:termId",
  validateObjectId("termId"),
  validatePagination,
  commentController.getCommentsByTerm,
);

/**
 * @route   PUT /api/comments/:id
 * @desc    Cập nhật bình luận
 * @access  Private - Owner
 */
router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  commentValidators.update,
  validate,
  commentController.updateComment,
);

/**
 * @route   DELETE /api/comments/:id
 * @desc    Xóa bình luận
 * @access  Private - Owner/Moderator/Admin
 */
router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  commentController.deleteComment,
);

/**
 * @route   POST /api/comments/:id/moderate
 * @desc    Kiểm duyệt bình luận
 * @access  Private - Moderator/Admin
 */
router.post(
  "/:id/moderate",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.COMMENTS),
  validateObjectId("id"),
  commentValidators.moderate,
  validate,
  commentController.moderateComment,
);

module.exports = router;
