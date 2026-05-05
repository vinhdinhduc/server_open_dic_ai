const Term = require("../models/Term");
const User = require("../models/User");
const Favorite = require("../models/Favorite");
const Contribution = require("../models/Contribution");
const { ReputationSummary } = require("../models/ReputationPoint");

const { TERM_STATUS } = require("../utils/constants");

/**
 * Get the date range filter based on period.
 */
function getPeriodFilter(period) {
  const now = new Date();

  switch (period) {
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { $gte: start };
    }
    case "quarterly": {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      return { $gte: start };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { $gte: start };
    }
    default:
      return null;
  }
}

function normalizePagination(page = 1, limit = 10) {
  const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip,
  };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}

function getNumericFieldExpression(fieldPath) {
  return {
    $convert: {
      input: fieldPath,
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };
}

/**
 * GET most-favorited terms.
 * - all_time: rank by Term.favoriteCount
 * - periodic: rank by count of Favorite documents in period
 */
exports.getMostFavoritedTerms = async ({
  period = "all_time",
  page = 1,
  limit = 10,
}) => {
  const pagination = normalizePagination(page, limit);
  const { skip } = pagination;

  if (period === "all_time") {
    const matchCondition = {
      status: TERM_STATUS.APPROVED,
      isDeleted: { $ne: true },
    };

    const [terms, total] = await Promise.all([
      Term.aggregate([
        { $match: matchCondition },
        {
          $lookup: {
            from: "favorites",
            let: { termId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$term", "$$termId"] },
                },
              },
              { $count: "total" },
            ],
            as: "favoriteStats",
          },
        },
        {
          $addFields: {
            favoriteCountValue: {
              $ifNull: [{ $arrayElemAt: ["$favoriteStats.total", 0] }, 0],
            },
            viewCountValue: getNumericFieldExpression("$viewCount"),
          },
        },
        {
          $setWindowFields: {
            sortBy: { favoriteCountValue: -1 },
            output: {
              rank: { $rank: {} },
            },
          },
        },
        { $sort: { favoriteCountValue: -1, _id: 1 } },
        { $skip: skip },
        { $limit: pagination.limit },
        {
          $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $unwind: {
            path: "$category",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdBy",
          },
        },
        {
          $unwind: {
            path: "$createdBy",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            term: 1,
            definition: 1,
            partOfSpeech: 1,
            favoriteCount: "$favoriteCountValue",
            viewCount: "$viewCountValue",
            rank: 1,
            category: {
              _id: "$category._id",
              name: "$category.name",
            },
            createdBy: {
              _id: "$createdBy._id",
              fullName: "$createdBy.fullName",
              avatar: "$createdBy.avatar",
            },
          },
        },
      ]),
      Term.countDocuments(matchCondition),
    ]);

    return {
      terms,
      pagination: buildPagination(pagination.page, pagination.limit, total),
    };
  }

  const periodFilter = getPeriodFilter(period);

  if (!periodFilter) {
    return exports.getMostFavoritedTerms({
      period: "all_time",
      page,
      limit,
    });
  }

  const [results, totalAgg] = await Promise.all([
    Favorite.aggregate([
      { $match: { createdAt: periodFilter } },
      {
        $group: {
          _id: "$term",
          periodFavoriteCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "_id",
          foreignField: "_id",
          as: "termData",
        },
      },
      { $unwind: "$termData" },
      {
        $match: {
          "termData.status": TERM_STATUS.APPROVED,
          "termData.isDeleted": { $ne: true },
        },
      },
      {
        $addFields: {
          favoriteCountValue: getNumericFieldExpression(
            "$termData.favoriteCount",
          ),
          viewCountValue: getNumericFieldExpression("$termData.viewCount"),
        },
      },
      {
        $setWindowFields: {
          sortBy: { periodFavoriteCount: -1 },
          output: {
            rank: { $rank: {} },
          },
        },
      },
      { $sort: { periodFavoriteCount: -1, _id: 1 } },
      { $skip: skip },
      { $limit: pagination.limit },
      {
        $lookup: {
          from: "categories",
          localField: "termData.category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $unwind: {
          path: "$categoryData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "termData.createdBy",
          foreignField: "_id",
          as: "createdByData",
        },
      },
      {
        $unwind: {
          path: "$createdByData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: "$termData._id",
          term: "$termData.term",
          definition: "$termData.definition",
          partOfSpeech: "$termData.partOfSpeech",
          favoriteCount: "$favoriteCountValue",
          viewCount: "$viewCountValue",
          periodFavoriteCount: 1,
          rank: 1,
          category: {
            _id: "$categoryData._id",
            name: "$categoryData.name",
          },
          createdBy: {
            _id: "$createdByData._id",
            fullName: "$createdByData.fullName",
            avatar: "$createdByData.avatar",
          },
        },
      },
    ]),
    Favorite.aggregate([
      { $match: { createdAt: periodFilter } },
      {
        $group: {
          _id: "$term",
          periodFavoriteCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "_id",
          foreignField: "_id",
          as: "termData",
        },
      },
      { $unwind: "$termData" },
      {
        $match: {
          "termData.status": TERM_STATUS.APPROVED,
          "termData.isDeleted": { $ne: true },
        },
      },
      { $count: "total" },
    ]),
  ]);

  const total = totalAgg[0]?.total || 0;

  return {
    terms: results,
    pagination: buildPagination(pagination.page, pagination.limit, total),
  };
};

exports.getMostViewedTerms = async ({
  period = "all_time",
  page = 1,
  limit = 10,
}) => {
  const pagination = normalizePagination(page, limit);
  const { skip } = pagination;

  void period;

  const matchCondition = {
    status: TERM_STATUS.APPROVED,
    isDeleted: { $ne: true },
  };

  const [terms, total] = await Promise.all([
    Term.aggregate([
      { $match: matchCondition },
      {
        $addFields: {
          viewCountValue: getNumericFieldExpression("$viewCount"),
          favoriteCountValue: getNumericFieldExpression("$favoriteCount"),
        },
      },
      {
        $setWindowFields: {
          sortBy: { viewCountValue: -1 },
          output: {
            rank: { $rank: {} },
          },
        },
      },
      { $sort: { viewCountValue: -1, _id: 1 } },
      { $skip: skip },
      { $limit: pagination.limit },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          term: 1,
          definition: 1,
          partOfSpeech: 1,
          viewCount: "$viewCountValue",
          favoriteCount: "$favoriteCountValue",
          rank: 1,
          category: {
            _id: "$category._id",
            name: "$category.name",
          },
          createdBy: {
            _id: "$createdBy._id",
            fullName: "$createdBy.fullName",
            avatar: "$createdBy.avatar",
          },
        },
      },
    ]),
    Term.countDocuments(matchCondition),
  ]);

  return {
    terms,
    pagination: buildPagination(pagination.page, pagination.limit, total),
  };
};

/**
 * GET users with most total favorites on their terms.
 */
exports.getMostLikedUsers = async ({ page = 1, limit = 10, from = null, to = null }) => {
  const pagination = normalizePagination(page, limit);
  const { skip } = pagination;

  // build favorite lookup pipeline with optional date filtering
  const favoriteLookupPipeline = [];
  const favMatch = { $expr: { $eq: ["$term", "$$termId"] } };
  if (from || to) {
    const dateCond = {};
    if (from) dateCond.$gte = new Date(from);
    if (to) dateCond.$lte = new Date(to);
    favMatch.createdAt = dateCond;
  }
  favoriteLookupPipeline.push({ $match: favMatch });
  favoriteLookupPipeline.push({ $count: "total" });

  const basePipeline = [
    {
      $match: {
        status: TERM_STATUS.APPROVED,
        isDeleted: { $ne: true },
        createdBy: { $ne: null },
      },
    },
    {
      $lookup: {
        from: "favorites",
        let: { termId: "$_id" },
        pipeline: favoriteLookupPipeline,
        as: "favoriteStats",
      },
    },
    {
      $addFields: {
        actualFavoriteCount: {
          $ifNull: [{ $arrayElemAt: ["$favoriteStats.total", 0] }, 0],
        },
      },
    },
    {
      $group: {
        _id: "$createdBy",
        totalFavorites: { $sum: "$actualFavoriteCount" },
        termCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
  ];

  const [users, totalAgg] = await Promise.all([
    Term.aggregate([
      ...basePipeline,
      {
        $setWindowFields: {
          sortBy: { totalFavorites: -1 },
          output: {
            rank: { $rank: {} },
          },
        },
      },
      { $sort: { totalFavorites: -1, _id: 1 } },
      { $skip: skip },
      { $limit: pagination.limit },
      {
        $project: {
          rank: 1,
          totalFavorites: 1,
          termCount: 1,
          user: {
            _id: "$user._id",
            fullName: "$user.fullName",
            avatar: "$user.avatar",
            contributionCount: "$user.contributionCount",
          },
        },
      },
    ]),
    Term.aggregate([...basePipeline, { $count: "total" }]),
  ]);

  const total = totalAgg[0]?.total || 0;

  return {
    users,
    pagination: buildPagination(pagination.page, pagination.limit, total),
  };
};

/**
 * GET users with most profile views.
 */
exports.getMostAttractiveUsers = async ({ page = 1, limit = 10, from = null, to = null }) => {
  const pagination = normalizePagination(page, limit);
  const { skip } = pagination;

  const matchCondition = { status: "active" };

  const [users, total] = await Promise.all([
    User.aggregate([
      { $match: matchCondition },
      {
        $addFields: {
          profileViewCountValue: getNumericFieldExpression("$profileViewCount"),
          contributionCountValue:
            getNumericFieldExpression("$contributionCount"),
        },
      },
      {
        $setWindowFields: {
          sortBy: { profileViewCountValue: -1 },
          output: {
            rank: { $rank: {} },
          },
        },
      },
      { $sort: { profileViewCountValue: -1, _id: 1 } },
      { $skip: skip },
      { $limit: pagination.limit },
      {
        $project: {
          fullName: 1,
          avatar: 1,
          contributionCount: "$contributionCountValue",
          profileViewCount: "$profileViewCountValue",
          createdAt: 1,
          rank: 1,
        },
      },
    ]),
    User.countDocuments(matchCondition),
  ]);

  return {
    users,
    pagination: buildPagination(pagination.page, pagination.limit, total),
  };
};

/**
 * GET public profile by user ID.
 * Increments profileViewCount (only when viewer is not the profile owner).
 */
exports.getPublicProfile = async (userId, viewerId = null) => {
  const user = await User.findById(userId)
    .select("fullName avatar profileViewCount role createdAt")
    .lean();

  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  if (!viewerId || viewerId.toString() !== userId.toString()) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { profileViewCount: 1 } },
      { new: true },
    )
      .select("profileViewCount")
      .lean();

    user.profileViewCount = Number(
      updatedUser?.profileViewCount ?? (user.profileViewCount || 0) + 1,
    );
  }

  const [approvedTermCount, approvedContributionCount, recentTerms] =
    await Promise.all([
      Term.countDocuments({
        createdBy: userId,
        status: TERM_STATUS.APPROVED,
        isDeleted: { $ne: true },
      }),
      Contribution.countDocuments({
        contributor: userId,
        status: "approved",
        isDeleted: { $ne: true },
      }),
      Term.find({
        createdBy: userId,
        status: TERM_STATUS.APPROVED,
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("term definition viewCount favoriteCount createdAt")
        .lean(),
    ]);

  const totalContributions = approvedTermCount + approvedContributionCount;

  let reputationInfo = null;

  try {
    const summary = await ReputationSummary.findOne({ user: userId })
      .select("totalPoints level badges currentStreak")
      .lean();

    if (summary) {
      reputationInfo = {
        totalPoints: summary.totalPoints,
        level: summary.level,
        badges: summary.badges,
        currentStreak: summary.currentStreak,
      };
    }
  } catch (_err) {
    // Reputation data is optional
  }

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.role,
      contributionCount: totalContributions,
      profileViewCount: Number(user.profileViewCount || 0),
      joinedAt: user.createdAt,
    },
    stats: {
      approvedTermCount,
      approvedContributionCount,
      totalContributions,
    },
    recentTerms,
    reputation: reputationInfo,
  };
};
