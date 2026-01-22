// src/routes/contributionRoutes.js
const express = require("express");
const { body } = require("express-validator");
const contributionController = require("../controllers/contributionController");
const { authenticate } = require("../middlewares/auth");
const { isModerator } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

const router = express.Router();

/**
 * @route   POST /api/contributions
 * @desc    Tạo đóng góp mới
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  [
    body("type")
      .isIn(["new_term", "edit_term"])
      .withMessage("Loại đóng góp không hợp lệ"),
    body("term.vi")
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt là bắt buộc"),
    body("definition.vi")
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt là bắt buộc"),
    body("category")
      .notEmpty()
      .withMessage("Danh mục là bắt buộc")
      .isMongoId()
      .withMessage("ID danh mục không hợp lệ"),
    body("targetTerm")
      .if(body("type").equals("edit_term"))
      .notEmpty()
      .withMessage("Thuật ngữ gốc là bắt buộc khi chỉnh sửa")
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    validate,
  ],
  contributionController.createContribution,
);

/**
 * @route   GET /api/contributions
 * @desc    Lấy danh sách đóng góp
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  validatePagination,
  contributionController.getContributions,
);

/**
 * @route   GET /api/contributions/my
 * @desc    Lấy đóng góp của user hiện tại
 * @access  Private
 */
router.get(
  "/my",
  authenticate,
  validatePagination,
  contributionController.getMyContributions,
);

/**
 * @route   GET /api/contributions/:id
 * @desc    Lấy chi tiết đóng góp
 * @access  Private
 */
router.get(
  "/:id",
  authenticate,
  validateObjectId("id"),
  contributionController.getContributionById,
);

/**
 * @route   POST /api/contributions/:id/approve
 * @desc    Phê duyệt đóng góp
 * @access  Private - Moderator/Admin
 */
router.post(
  "/:id/approve",
  authenticate,
  isModerator,
  validateObjectId("id"),
  contributionController.approveContribution,
);

/**
 * @route   POST /api/contributions/:id/reject
 * @desc    Từ chối đóng góp
 * @access  Private - Moderator/Admin
 */
router.post(
  "/:id/reject",
  authenticate,
  isModerator,
  validateObjectId("id"),
  [
    body("moderatorNote")
      .trim()
      .notEmpty()
      .withMessage("Vui lòng nhập lý do từ chối"),
    validate,
  ],
  contributionController.rejectContribution,
);

/**
 * @route   DELETE /api/contributions/:id
 * @desc    Xóa đóng góp
 * @access  Private - Owner/Admin
 */
router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  contributionController.deleteContribution,
);

module.exports = router;
