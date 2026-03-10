const express = require("express");
const contributionController = require("../controllers/contributionController");
const { authenticate } = require("../middlewares/auth");
const { checkModeratorPermission } = require("../middlewares/authorize");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { contributionValidators } = require("../validators");
const { MODERATION_PERMISSIONS } = require("../utils/constants");
const { contentCreationLimiter } = require("../middlewares/rateLimiter");
const { verifyRecaptcha } = require("../middlewares/recaptcha");

const router = express.Router();

/**
 * @route   POST /api/contributions
 * @desc    Tạo đóng góp mới
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  contentCreationLimiter,
  verifyRecaptcha,
  contributionValidators.create,
  validate,
  contributionController.createContribution,
);

/**
 * @route   POST /api/contributions/bulk-approve
 * @desc    Phê duyệt nhiều đóng góp cùng lúc
 * @access  Private - Moderator/Admin
 */
router.post(
  "/bulk-approve",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.CONTRIBUTIONS),
  contributionController.bulkApprove,
);

/**
 * @route   POST /api/contributions/bulk-reject
 * @desc    Từ chối nhiều đóng góp cùng lúc
 * @access  Private - Moderator/Admin
 */
router.post(
  "/bulk-reject",
  authenticate,
  checkModeratorPermission(MODERATION_PERMISSIONS.CONTRIBUTIONS),
  contributionController.bulkReject,
);

/**
 * @route   GET /api/contributions
 * @desc    Lấy danh sách đóng góp (của mình hoặc tất cả tùy role)
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  validatePagination,
  contributionController.getMyContribution,
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
  checkModeratorPermission(MODERATION_PERMISSIONS.CONTRIBUTIONS),
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
  checkModeratorPermission(MODERATION_PERMISSIONS.CONTRIBUTIONS),
  validateObjectId("id"),
  contributionValidators.reject,
  validate,
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
