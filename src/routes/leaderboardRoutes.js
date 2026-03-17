const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController");
const { optionalAuth } = require("../middlewares/auth");
const {
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

/**
 * @route   GET /api/leaderboard/terms
 * @query   type: "most_favorited" | "most_viewed"
 * @query   period: "all_time" | "monthly" | "quarterly" | "yearly"
 * @access  Public
 */
router.get(
  "/terms",
  validatePagination,
  leaderboardController.getTermsLeaderboard,
);

/**
 * @route   GET /api/leaderboard/users
 * @query   type: "most_liked" | "most_attractive"
 * @access  Public
 */
router.get(
  "/users",
  validatePagination,
  leaderboardController.getUsersLeaderboard,
);

/**
 * @route   GET /api/leaderboard/public-profile/:id
 * @access  Public (optionalAuth to skip self-view increment)
 */
router.get(
  "/public-profile/:id",
  optionalAuth,
  validateObjectId("id"),
  leaderboardController.getPublicProfile,
);

module.exports = router;
