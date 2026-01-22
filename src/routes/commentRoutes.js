const express = require("express");
const { body } = require("express-validator");
const commentController = require("../controllers/commentController");
const { authenticate } = require("../middlewares/auth");
const { isModerator } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

const router = express.Router();

/**
 * @route   POST /api/comments
 * @desc    Tạo bình luận
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  [
    body("termId")
      .notEmpty()
      .withMessage("ID thuật ngữ là bắt buộc")
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Nội dung bình luận là bắt buộc")
      .isLength({ min: 3, max: 500 })
      .withMessage("Bình luận phải từ 3-500 ký tự"),
    body("parentComment")
      .optional()
      .isMongoId()
      .withMessage("ID bình luận cha không hợp lệ"),
    validate,
  ],
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
  [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Nội dung bình luận là bắt buộc")
      .isLength({ min: 3, max: 500 })
      .withMessage("Bình luận phải từ 3-500 ký tự"),
    validate,
  ],
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
  isModerator,
  validateObjectId("id"),
  [
    body("status")
      .isIn(["approved", "rejected"])
      .withMessage("Trạng thái không hợp lệ"),
    validate,
  ],
  commentController.moderateComment,
);

module.exports = router;
