const express = require("express");
const reportStatsController = require("../controllers/reportStatsController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin, isModerator } = require("../middlewares/authorize");

const router = express.Router();

/**
 * @route   GET /api/report-stats/overview
 * @desc    Lấy thống kê tổng quan hệ thống
 * @access  Private - Admin
 */
router.get(
  "/overview",
  authenticate,
  isAdmin,
  reportStatsController.getSystemOverview,
);

/**
 * @route   GET /api/report-stats/terms-over-time
 * @desc    Lấy thống kê thuật ngữ theo thời gian
 * @access  Private - Admin
 */
router.get(
  "/terms-over-time",
  authenticate,
  isAdmin,
  reportStatsController.getTermsOverTime,
);

/**
 * @route   GET /api/report-stats/users-over-time
 * @desc    Lấy thống kê người dùng theo thời gian
 * @access  Private - Admin
 */
router.get(
  "/users-over-time",
  authenticate,
  isAdmin,
  reportStatsController.getUsersOverTime,
);

/**
 * @route   GET /api/report-stats/terms-by-category
 * @desc    Lấy thống kê thuật ngữ theo danh mục
 * @access  Private - Admin
 */
router.get(
  "/terms-by-category",
  authenticate,
  isAdmin,
  reportStatsController.getTermsByCategory,
);

/**
 * @route   GET /api/report-stats/contributions-over-time
 * @desc    Lấy thống kê đóng góp theo thời gian
 * @access  Private - Admin
 */
router.get(
  "/contributions-over-time",
  authenticate,
  isAdmin,
  reportStatsController.getContributionsOverTime,
);

/**
 * @route   GET /api/report-stats/top-contributors
 * @desc    Lấy top người đóng góp
 * @access  Private - Admin
 */
router.get(
  "/top-contributors",
  authenticate,
  isAdmin,
  reportStatsController.getTopContributors,
);

/**
 * @route   GET /api/report-stats/top-viewed-terms
 * @desc    Lấy thuật ngữ được xem nhiều nhất
 * @access  Private - Admin
 */
router.get(
  "/top-viewed-terms",
  authenticate,
  isAdmin,
  reportStatsController.getTopViewedTerms,
);

/**
 * @route   GET /api/report-stats/users-by-role
 * @desc    Lấy thống kê người dùng theo vai trò
 * @access  Private - Admin
 */
router.get(
  "/users-by-role",
  authenticate,
  isAdmin,
  reportStatsController.getUsersByRole,
);

/**
 * @route   GET /api/report-stats/full
 * @desc    Lấy báo cáo tổng hợp đầy đủ
 * @access  Private - Admin
 */
router.get("/full", authenticate, isAdmin, reportStatsController.getFullReport);

module.exports = router;
