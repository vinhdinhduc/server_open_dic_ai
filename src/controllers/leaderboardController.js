const leaderboardService = require("../services/leaderboardService");
const { successResponse } = require("../utils/response");

/**
 * @route   GET /api/leaderboard/terms
 * @desc    Most-favorited or most-viewed terms (with optional period filter)
 * @query   type: "most_favorited" | "most_viewed"
 * @query   period: "all_time" | "monthly" | "quarterly" | "yearly"
 * @access  Public
 */
exports.getTermsLeaderboard = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 10 };
    const type = req.query.type || "most_viewed";
    const period = req.query.period || "all_time";

    let result;
    if (type === "most_favorited") {
      result = await leaderboardService.getMostFavoritedTerms({
        period,
        page,
        limit,
      });
    } else {
      result = await leaderboardService.getMostViewedTerms({
        period,
        page,
        limit,
      });
    }

    return successResponse(
      res,
      "Lấy bảng xếp hạng thuật ngữ thành công",
      result,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/leaderboard/users
 * @desc    Most-liked users (term favorites) or most-attractive users (profile views)
 * @query   type: "most_liked" | "most_attractive"
 * @access  Public
 */
exports.getUsersLeaderboard = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 10 };
    const type = req.query.type || "most_liked";

    let result;
    if (type === "most_attractive") {
      result = await leaderboardService.getMostAttractiveUsers({ page, limit });
    } else {
      result = await leaderboardService.getMostLikedUsers({ page, limit });
    }

    return successResponse(
      res,
      "Lấy bảng xếp hạng người dùng thành công",
      result,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/leaderboard/public-profile/:id
 * @desc    Get public profile of a user
 * @access  Public (view count incremented for non-owners)
 */
exports.getPublicProfile = async (req, res, next) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await leaderboardService.getPublicProfile(
      req.params.id,
      viewerId,
    );
    return successResponse(res, "Lấy hồ sơ công khai thành công", result);
  } catch (error) {
    next(error);
  }
};
