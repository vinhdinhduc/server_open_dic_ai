const Term = require("../models/Term");
const User = require("../models/User");
const Category = require("../models/Category");
const Contribution = require("../models/Contribution");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const SearchHistory = require("../models/SearchHistory");
const AIUsageDaily = require("../models/AIUsageDaily");
const SystemConfig = require("../models/SystemConfig");
const mongoose = require("mongoose");

/**
 * Lấy thống kê tổng quan hệ thống
 */
exports.getSystemOverview = async () => {
  const [
    totalUsers,
    totalTerms,
    totalContributions,
    totalComments,
    totalCategories,
    totalReports,
    activeUsers,
    pendingContributions,
    approvedTerms,
    pendingTerms,
  ] = await Promise.all([
    User.countDocuments(),
    Term.countDocuments(),
    Contribution.countDocuments(),
    Comment.countDocuments(),
    Category.countDocuments({ isActive: true }),
    Report.countDocuments({ status: "pending" }),
    User.countDocuments({ status: "active" }),
    Contribution.countDocuments({ status: "pending" }),
    Term.countDocuments({ status: "approved" }),
    Term.countDocuments({ status: "pending" }),
  ]);

  return {
    totalUsers,
    totalTerms,
    totalContributions,
    totalComments,
    totalCategories,
    totalReports,
    activeUsers,
    pendingContributions,
    approvedTerms,
    pendingTerms,
  };
};

/**
 * Thống kê thuật ngữ theo thời gian (cho biểu đồ line/bar)
 */
exports.getTermsOverTime = async (period = "month", months = 12) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let groupFormat;
  if (period === "day") {
    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  } else if (period === "week") {
    groupFormat = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
  } else {
    groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
  }

  const result = await Term.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: groupFormat,
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  // Format cho frontend chart
  const dateMap = {};
  result.forEach((item) => {
    const date = item._id.date;
    if (!dateMap[date]) {
      dateMap[date] = { date, approved: 0, pending: 0, rejected: 0, total: 0 };
    }
    dateMap[date][item._id.status] = item.count;
    dateMap[date].total += item.count;
  });

  return Object.values(dateMap);
};

/**
 * Thống kê người dùng theo thời gian
 */
exports.getUsersOverTime = async (months = 12) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((item) => ({
    date: item._id,
    count: item.count,
  }));
};

/**
 * Thống kê thuật ngữ theo danh mục (pie chart)
 */
exports.getTermsByCategory = async () => {
  const result = await Term.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        count: 1,
        name: { $ifNull: ["$category.name.vi", "Không phân loại"] },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return result;
};

/**
 * Thống kê đóng góp theo thời gian
 */
exports.getContributionsOverTime = async (months = 12) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await Contribution.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  const dateMap = {};
  result.forEach((item) => {
    const date = item._id.date;
    if (!dateMap[date]) {
      dateMap[date] = { date, approved: 0, pending: 0, rejected: 0, total: 0 };
    }
    dateMap[date][item._id.status] = item.count;
    dateMap[date].total += item.count;
  });

  return Object.values(dateMap);
};

/**
 * Thống kê mức độ request AI theo ngày
 */
exports.getAIRequestsDaily = async (days = 14) => {
  const normalizedDays = Math.min(Math.max(parseInt(days, 10) || 14, 1), 90);

  const today = new Date();
  const endDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - normalizedDays + 1);

  const [dailyDocs, maxDailyRequestsConfig, maxDailyTokensConfig] =
    await Promise.all([
      AIUsageDaily.find({ date: { $gte: startDate } })
        .sort({ date: 1 })
        .lean(),
      SystemConfig.getValue("ai_max_daily_requests", 1000),
      SystemConfig.getValue("ai_max_daily_tokens", 500000),
    ]);

  const docMap = new Map(dailyDocs.map((doc) => [doc.dateKey, doc]));
  const data = [];

  for (let i = 0; i < normalizedDays; i++) {
    const dateObj = new Date(startDate);
    dateObj.setUTCDate(startDate.getUTCDate() + i);
    const dateKey = dateObj.toISOString().split("T")[0];

    const doc = docMap.get(dateKey);
    const requestCount = doc?.requestCount || 0;
    const tokenCount = doc?.tokenCount || 0;
    const maxDailyRequests = doc?.maxDailyRequests || maxDailyRequestsConfig;
    const maxDailyTokens = doc?.maxDailyTokens || maxDailyTokensConfig;

    data.push({
      date: dateKey,
      requestCount,
      tokenCount,
      maxDailyRequests,
      maxDailyTokens,
      requestPercent:
        maxDailyRequests > 0
          ? Number(((requestCount / maxDailyRequests) * 100).toFixed(2))
          : 0,
      tokenPercent:
        maxDailyTokens > 0
          ? Number(((tokenCount / maxDailyTokens) * 100).toFixed(2))
          : 0,
    });
  }

  return {
    days: normalizedDays,
    data,
    today: data[data.length - 1] || null,
  };
};

/**
 * Top người đóng góp
 */
exports.getTopContributors = async (limit = 10) => {
  const result = await Contribution.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$contributor",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        count: 1,
        fullName: { $ifNull: ["$user.fullName", "Unknown"] },
        email: { $ifNull: ["$user.email", ""] },
      },
    },
  ]);

  return result;
};

/**
 * Thuật ngữ được xem nhiều nhất
 */
exports.getTopViewedTerms = async (limit = 10) => {
  const terms = await Term.find({ status: "approved" })
    .sort({ viewCount: -1 })
    .limit(limit)
    .select("term viewCount favoriteCount commentCount category")
    .populate("category", "name.vi")
    .lean();

  return terms;
};

/**
 * Thống kê người dùng theo vai trò
 */
exports.getUsersByRole = async () => {
  const result = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  return result.map((item) => ({
    role: item._id,
    count: item.count,
  }));
};

/**
 * Thống kê hoạt động gần đây (dashboard activity)
 */
exports.getRecentActivity = async (limit = 20) => {
  const [recentTerms, recentContributions, recentComments, recentUsers] =
    await Promise.all([
      Term.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("term status createdAt createdBy")
        .populate("createdBy", "fullName")
        .lean(),
      Contribution.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("type status createdAt contributor term")
        .populate("contributor", "fullName")
        .lean(),
      Comment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("content createdAt author term")
        .populate("author", "fullName")
        .lean(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("fullName email role createdAt")
        .lean(),
    ]);

  // Merge and sort by date
  const activities = [
    ...recentTerms.map((t) => ({
      type: "term",
      title: t.term?.vi || "Thuật ngữ mới",
      user: t.createdBy?.fullName || "System",
      status: t.status,
      date: t.createdAt,
    })),
    ...recentContributions.map((c) => ({
      type: "contribution",
      title: c.term?.vi || "Đóng góp",
      user: c.contributor?.fullName || "User",
      status: c.status,
      date: c.createdAt,
    })),
    ...recentComments.map((c) => ({
      type: "comment",
      title:
        c.content?.substring(0, 50) + (c.content?.length > 50 ? "..." : ""),
      user: c.author?.fullName || "User",
      date: c.createdAt,
    })),
    ...recentUsers.map((u) => ({
      type: "new_user",
      title: u.fullName,
      user: u.email,
      role: u.role,
      date: u.createdAt,
    })),
  ];

  activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  return activities.slice(0, limit);
};

/**
 * Tổng hợp báo cáo đầy đủ
 */
exports.getFullReport = async (options = {}) => {
  const { period = "month", months = 12 } = options;

  const [
    overview,
    termsOverTime,
    usersOverTime,
    termsByCategory,
    contributionsOverTime,
    topContributors,
    topViewedTerms,
    usersByRole,
    recentActivity,
    aiRequestsDaily,
  ] = await Promise.all([
    exports.getSystemOverview(),
    exports.getTermsOverTime(period, months),
    exports.getUsersOverTime(months),
    exports.getTermsByCategory(),
    exports.getContributionsOverTime(months),
    exports.getTopContributors(10),
    exports.getTopViewedTerms(10),
    exports.getUsersByRole(),
    exports.getRecentActivity(20),
    exports.getAIRequestsDaily(14),
  ]);

  return {
    overview,
    termsOverTime,
    usersOverTime,
    termsByCategory,
    contributionsOverTime,
    topContributors,
    topViewedTerms,
    usersByRole,
    recentActivity,
    aiRequestsDaily,
  };
};
