const {
  ReputationHistory,
  ReputationSummary,
  RedemptionRequest,
} = require("../models/ReputationPoint");
const User = require("../models/User");
const notificationService = require("./notificationService");
const { REPUTATION, NOTIFICATION_TYPES } = require("../utils/constants");
const crypto = require("crypto");
const pdfService = require("./pdfService");

// ==================== CORE ====================

/**
 * Lấy hoặc tạo summary cho user
 */
const getOrCreateSummary = async (userId) => {
  let summary = await ReputationSummary.findOne({ user: userId });
  if (!summary) {
    summary = await ReputationSummary.create({ user: userId });
  }
  return summary;
};

/**
 * Tính ĐUT từ các điểm thành phần
 * ĐUT = (ĐĐG × 0.5) + (ĐBX × 0.3) + (ĐT × 0.2) − ĐP
 */
const calculateTotalPoints = (summary) => {
  const w = REPUTATION.WEIGHTS;
  const raw =
    summary.contributionPoints * w.CONTRIBUTION +
    summary.reportPoints * w.REPORT +
    summary.bonusPoints * w.BONUS -
    summary.penaltyPoints;
  return Math.max(0, Math.round(raw));
};

/**
 * Xác định level dựa trên tổng điểm
 */
const determineLevel = (totalPoints) => {
  const levels = REPUTATION.LEVELS;
  for (let lvl = 5; lvl >= 1; lvl--) {
    if (totalPoints >= levels[lvl].min) {
      return lvl;
    }
  }
  return 1;
};

/**
 * Kiểm tra giới hạn điểm/ngày
 */
const checkDailyLimit = (summary, category) => {
  const today = new Date().toISOString().split("T")[0];

  if (summary.dailyPointsDate !== today) {
    summary.dailyContributionPoints = 0;
    summary.dailyReportPoints = 0;
    summary.dailyPointsDate = today;
  }

  if (category === "contribution") {
    return (
      summary.dailyContributionPoints < REPUTATION.DAILY_LIMITS.CONTRIBUTION
    );
  }
  if (category === "report") {
    return summary.dailyReportPoints < REPUTATION.DAILY_LIMITS.REPORT;
  }
  return true;
};

/**
 * Cập nhật streak
 */
const updateStreak = (summary) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!summary.lastActivityDate) {
    summary.currentStreak = 1;
    summary.lastActivityDate = today;
    return;
  }

  const lastDate = new Date(summary.lastActivityDate);
  lastDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Cùng ngày, không tăng streak
    return;
  } else if (diffDays === 1) {
    summary.currentStreak += 1;
  } else {
    summary.currentStreak = 1;
  }

  if (summary.currentStreak > summary.longestStreak) {
    summary.longestStreak = summary.currentStreak;
  }
  summary.lastActivityDate = today;
};

/**
 * Tính hệ số streak
 */
const getStreakMultiplier = (streak) => {
  if (streak >= 30) return REPUTATION.STREAK.DAYS_30_MULTIPLIER;
  if (streak >= 7) return REPUTATION.STREAK.DAYS_7_MULTIPLIER;
  return 1;
};

/**
 * Tính hệ số chính xác báo xấu
 */
const getReportAccuracyMultiplier = (summary) => {
  if (summary.totalReports < REPUTATION.REPORT_ACCURACY.DEGRADE_THRESHOLD) {
    return 1;
  }
  const accuracy = summary.approvedReports / summary.totalReports;
  if (accuracy < 0.5) {
    return REPUTATION.REPORT_ACCURACY.DEGRADE_MULTIPLIER;
  }
  return 1;
};

// ==================== CHỨC NĂNG CHÍNH ====================

/**
 * Cộng/trừ điểm uy tín cho user
 */
exports.addPoints = async (
  userId,
  {
    action,
    points,
    category,
    description,
    relatedId,
    relatedModel,
    metadata = {},
  },
) => {
  const summary = await getOrCreateSummary(userId);

  // Kiểm tra giới hạn/ngày cho điểm dương
  if (points > 0 && !checkDailyLimit(summary, category)) {
    return { limited: true, message: "Đã đạt giới hạn điểm trong ngày" };
  }

  // Áp dụng hệ số streak cho điểm dương
  let finalPoints = points;
  if (points > 0) {
    const streakMultiplier = getStreakMultiplier(summary.currentStreak);
    finalPoints = Math.round(points * streakMultiplier);
  }

  // Áp dụng report accuracy multiplier
  if (category === "report" && points > 0) {
    const accMultiplier = getReportAccuracyMultiplier(summary);
    finalPoints = Math.round(finalPoints * accMultiplier);
  }

  // Ghi lịch sử
  const history = await ReputationHistory.create({
    user: userId,
    action,
    points: finalPoints,
    category,
    description,
    relatedId,
    relatedModel,
    metadata: {
      ...metadata,
      originalPoints: points,
      appliedMultiplier: finalPoints / points,
    },
  });

  // Cập nhật summary theo category
  if (category === "contribution") {
    summary.contributionPoints = Math.max(
      0,
      summary.contributionPoints + finalPoints,
    );
    if (finalPoints > 0) summary.dailyContributionPoints += finalPoints;
  } else if (category === "report") {
    summary.reportPoints = Math.max(0, summary.reportPoints + finalPoints);
    if (finalPoints > 0) summary.dailyReportPoints += finalPoints;
  } else if (category === "bonus") {
    summary.bonusPoints = Math.max(0, summary.bonusPoints + finalPoints);
  } else if (category === "penalty") {
    summary.penaltyPoints += Math.abs(finalPoints);
  } else if (category === "redemption") {
    // Không trừ bất kì thành phần nào, trừ thẳng vào totalPoints
  }

  // Cập nhật streak
  updateStreak(summary);

  // Tính tổng điểm mới
  const oldLevel = summary.level;
  summary.totalPoints = calculateTotalPoints(summary);
  summary.level = determineLevel(summary.totalPoints);

  // Kiểm tra level up → thông báo
  if (summary.level > oldLevel) {
    const levelInfo = REPUTATION.LEVELS[summary.level];
    await notificationService.createNotification({
      recipient: userId,
      type: NOTIFICATION_TYPES.REPUTATION_MILESTONE,
      title: `Chúc mừng! Bạn đã đạt mức \"${levelInfo.name}\"`,
      message: `Điểm uy tín: ${summary.totalPoints}. Bạn được sử dụng ${levelInfo.aiQueries} câu hỏi AI/ngày.`,
      metadata: { level: summary.level, totalPoints: summary.totalPoints },
    });

    // Thêm badge
    const badgeKey = `level_${summary.level}`;
    if (!summary.badges.includes(badgeKey)) {
      summary.badges.push(badgeKey);
    }
  }

  // Streak badges
  if (summary.currentStreak >= 7 && !summary.badges.includes("streak_7")) {
    summary.badges.push("streak_7");
  }
  if (summary.currentStreak >= 30 && !summary.badges.includes("streak_30")) {
    summary.badges.push("streak_30");
  }

  await summary.save();

  return { history, summary, finalPoints };
};

// ==================== CONTRIBUTION HANDLERS ====================

exports.onTermSubmitted = async (userId, termId) => {
  return exports.addPoints(userId, {
    action: "term_submitted",
    points: REPUTATION.CONTRIBUTION_POINTS.TERM_SUBMITTED,
    category: "contribution",
    description: "Đã gửi thuật ngữ mới",
    relatedId: termId,
    relatedModel: "Term",
  });
};

exports.onTermApproved = async (userId, termId) => {
  return exports.addPoints(userId, {
    action: "term_approved",
    points: REPUTATION.CONTRIBUTION_POINTS.TERM_APPROVED,
    category: "contribution",
    description: "Thuật ngữ được duyệt",
    relatedId: termId,
    relatedModel: "Term",
  });
};

exports.onTermRejectedSpam = async (userId, termId) => {
  return exports.addPoints(userId, {
    action: "term_rejected_spam",
    points: REPUTATION.CONTRIBUTION_POINTS.TERM_REJECTED_SPAM,
    category: "penalty",
    description: "Thuật ngữ bị từ chối (spam/trùng lặp)",
    relatedId: termId,
    relatedModel: "Term",
  });
};

exports.onEditSubmitted = async (userId, contributionId) => {
  return exports.addPoints(userId, {
    action: "edit_submitted",
    points: REPUTATION.CONTRIBUTION_POINTS.EDIT_SUBMITTED,
    category: "contribution",
    description: "Đã gửi gợi ý chỉnh sửa",
    relatedId: contributionId,
    relatedModel: "Contribution",
  });
};

exports.onEditApproved = async (userId, contributionId) => {
  return exports.addPoints(userId, {
    action: "edit_approved",
    points: REPUTATION.CONTRIBUTION_POINTS.EDIT_APPROVED,
    category: "contribution",
    description: "Gợi ý chỉnh sửa được chấp nhận",
    relatedId: contributionId,
    relatedModel: "Contribution",
  });
};

exports.onEditRejectedSabotage = async (userId, contributionId) => {
  return exports.addPoints(userId, {
    action: "edit_rejected_sabotage",
    points: REPUTATION.CONTRIBUTION_POINTS.EDIT_REJECTED_SABOTAGE,
    category: "penalty",
    description: "Gợi ý chỉnh sửa bị từ chối (phá hoại)",
    relatedId: contributionId,
    relatedModel: "Contribution",
  });
};

// ==================== REPORT HANDLERS ====================

exports.onReportResolved = async (userId, reportId, reason) => {
  const pointsKey = `APPROVED_${reason.toUpperCase()}`;
  const points = REPUTATION.REPORT_POINTS[pointsKey] || 8;

  const summary = await getOrCreateSummary(userId);
  summary.totalReports += 1;
  summary.approvedReports += 1;
  await summary.save();

  return exports.addPoints(userId, {
    action: `report_approved_${reason}`,
    points,
    category: "report",
    description: `Báo xấu được xác nhận (${reason})`,
    relatedId: reportId,
    relatedModel: "Report",
  });
};

exports.onReportRejected = async (userId, reportId, reason) => {
  const pointsKey = `REJECTED_${reason.toUpperCase()}`;
  const points = REPUTATION.REPORT_POINTS[pointsKey] || -3;

  const summary = await getOrCreateSummary(userId);
  summary.totalReports += 1;
  await summary.save();

  return exports.addPoints(userId, {
    action: `report_rejected_${reason}`,
    points: Math.abs(points),
    category: "penalty",
    description: `Báo xấu bị từ chối (${reason})`,
    relatedId: reportId,
    relatedModel: "Report",
  });
};

// ==================== MILESTONES ====================

exports.onTermViewMilestone = async (userId, termId, viewCount) => {
  if (viewCount % 100 !== 0) return null;
  return exports.addPoints(userId, {
    action: "term_view_milestone",
    points: REPUTATION.CONTRIBUTION_POINTS.TERM_VIEW_MILESTONE,
    category: "bonus",
    description: `Thuật ngữ đạt ${viewCount} lượt xem`,
    relatedId: termId,
    relatedModel: "Term",
    metadata: { viewCount },
  });
};

exports.onTermFavoriteMilestone = async (userId, termId, favoriteCount) => {
  if (favoriteCount % 10 !== 0) return null;
  return exports.addPoints(userId, {
    action: "term_favorite_milestone",
    points: REPUTATION.CONTRIBUTION_POINTS.TERM_FAVORITE_MILESTONE,
    category: "bonus",
    description: `Thuật ngữ đạt ${favoriteCount} lượt yêu thích`,
    relatedId: termId,
    relatedModel: "Term",
    metadata: { favoriteCount },
  });
};

// ==================== DECAY (chạy bằng cron) ====================

exports.processInactivityDecay = async () => {
  const thresholdDate = new Date();
  thresholdDate.setDate(
    thresholdDate.getDate() - REPUTATION.DECAY.INACTIVE_DAYS,
  );

  const inactiveUsers = await ReputationSummary.find({
    lastActivityDate: { $lt: thresholdDate },
    totalPoints: { $gt: 0 },
  });

  let processed = 0;
  for (const summary of inactiveUsers) {
    const daysSinceActivity = Math.floor(
      (new Date() - new Date(summary.lastActivityDate)) / (1000 * 60 * 60 * 24),
    );
    const daysOverThreshold =
      daysSinceActivity - REPUTATION.DECAY.INACTIVE_DAYS;
    const totalDecay = Math.max(
      REPUTATION.DECAY.MAX_PENALTY,
      daysOverThreshold * REPUTATION.DECAY.DAILY_PENALTY,
    );

    // Chỉ trừ phần chưa trừ
    const alreadyDecayed = await ReputationHistory.aggregate([
      { $match: { user: summary.user, action: "inactivity_decay" } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    const previousDecay = alreadyDecayed[0]?.total || 0;
    const newDecay = totalDecay - previousDecay;

    if (newDecay < 0) {
      await exports.addPoints(summary.user, {
        action: "inactivity_decay",
        points: newDecay,
        category: "penalty",
        description: `Trừ điểm do không hoạt động (${daysSinceActivity} ngày)`,
      });
      processed++;
    }
  }

  return { processed };
};

// ==================== QUERY ====================

exports.getUserReputation = async (userId) => {
  const summary = await getOrCreateSummary(userId);
  const levelInfo = REPUTATION.LEVELS[summary.level];

  return {
    totalPoints: summary.totalPoints,
    level: summary.level,
    levelName: levelInfo.name,
    nextLevel: summary.level < 5 ? REPUTATION.LEVELS[summary.level + 1] : null,
    pointsToNextLevel:
      summary.level < 5
        ? REPUTATION.LEVELS[summary.level + 1].min - summary.totalPoints
        : 0,
    breakdown: {
      contribution: summary.contributionPoints,
      report: summary.reportPoints,
      bonus: summary.bonusPoints,
      penalty: summary.penaltyPoints,
    },
    streak: {
      current: summary.currentStreak,
      longest: summary.longestStreak,
      multiplier: getStreakMultiplier(summary.currentStreak),
    },
    aiAccess: {
      dailyQueries: levelInfo.aiQueries,
      features: levelInfo.features,
    },
    badges: summary.badges,
    isUtbStudent: summary.isUtbStudent,
    reportAccuracy:
      summary.totalReports > 0
        ? Math.round((summary.approvedReports / summary.totalReports) * 100)
        : 100,
  };
};

exports.getReputationHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20, category } = options;
  const skip = (page - 1) * limit;

  const query = { user: userId };
  if (category) query.category = category;

  const [history, total] = await Promise.all([
    ReputationHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ReputationHistory.countDocuments(query),
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

exports.getLeaderboard = async (options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [leaderboard, total] = await Promise.all([
    ReputationSummary.find({ totalPoints: { $gt: 0 } })
      .sort({ totalPoints: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "fullName avatar email")
      .lean(),
    ReputationSummary.countDocuments({ totalPoints: { $gt: 0 } }),
  ]);

  return {
    leaderboard: leaderboard.map((entry, index) => ({
      rank: skip + index + 1,
      user: entry.user,
      totalPoints: entry.totalPoints,
      level: entry.level,
      levelName: REPUTATION.LEVELS[entry.level]?.name,
      badges: entry.badges,
      currentStreak: entry.currentStreak,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// ==================== KIỂM TRA QUYỀN AI ====================

exports.checkAIAccess = async (userId, feature = "explanation") => {
  const summary = await getOrCreateSummary(userId);
  const levelInfo = REPUTATION.LEVELS[summary.level];

  const hasFeature =
    levelInfo.features.includes(feature) ||
    levelInfo.features.includes("unlimited");

  return {
    allowed: hasFeature,
    level: summary.level,
    levelName: levelInfo.name,
    dailyQueries: levelInfo.aiQueries,
    availableFeatures: levelInfo.features,
  };
};

// ==================== UTB STUDENT ====================

exports.verifyUtbStudent = async (userId) => {
  const user = await User.findById(userId).select("email");
  if (!user) {
    const error = new Error("User không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  const domain = user.email.split("@")[1];
  if (domain !== REPUTATION.REDEMPTION.UTB_EMAIL_DOMAIN) {
    const error = new Error("Email không thuộc trường ĐHTB");
    error.statusCode = 400;
    throw error;
  }

  const summary = await getOrCreateSummary(userId);
  summary.isUtbStudent = true;
  if (!summary.badges.includes("utb_verified")) {
    summary.badges.push("utb_verified");
  }
  await summary.save();

  return { verified: true };
};

exports.requestRedemption = async (
  userId,
  { type, semester, studentId, studentClass, faculty, phone },
) => {
  const summary = await getOrCreateSummary(userId);

  if (!summary.isUtbStudent) {
    const error = new Error("Chỉ sinh viên ĐHTB mới có thể đổi điểm");
    error.statusCode = 403;
    throw error;
  }

  const { POINTS_PER_TRAINING, MAX_TRAINING_PER_SEMESTER } =
    REPUTATION.REDEMPTION;

  if (summary.totalPoints < POINTS_PER_TRAINING) {
    const error = new Error(`Cần tối thiểu ${POINTS_PER_TRAINING} ĐUT để đổi`);
    error.statusCode = 400;
    throw error;
  }

  // Kiểm tra giới hạn/học kỳ
  const existingInSemester = await RedemptionRequest.find({
    user: userId,
    semester,
    status: { $in: ["pending", "approved"] },
  });
  const totalTrainingInSemester = existingInSemester.reduce(
    (sum, r) => sum + r.trainingPointsGained,
    0,
  );

  if (totalTrainingInSemester >= MAX_TRAINING_PER_SEMESTER) {
    const error = new Error(
      `Đã đạt giới hạn ${MAX_TRAINING_PER_SEMESTER} điểm/học kỳ`,
    );
    error.statusCode = 400;
    throw error;
  }

  const maxRedeemable = MAX_TRAINING_PER_SEMESTER - totalTrainingInSemester;
  const maxByPoints = Math.floor(summary.totalPoints / POINTS_PER_TRAINING);
  const trainingPointsGained = Math.min(maxRedeemable, maxByPoints);
  const pointsUsed = trainingPointsGained * POINTS_PER_TRAINING;

  const request = await RedemptionRequest.create({
    user: userId,
    type,
    pointsUsed,
    trainingPointsGained,
    semester,
    studentId: studentId?.trim(),
    studentClass: studentClass?.trim(),
    faculty: faculty?.trim(),
    phone: phone?.trim(),
  });

  // Thông báo admin
  await notificationService.notifyAdmins({
    type: NOTIFICATION_TYPES.REDEMPTION_REQUEST,
    title: "Yêu cầu đổi điểm rèn luyện mới",
    message: `Sinh viên yêu cầu đổi ${pointsUsed} ĐUT → ${trainingPointsGained} điểm rèn luyện`,
    metadata: { requestId: request._id, userId },
  });

  return request;
};

exports.reviewRedemption = async (requestId, adminId, { status, note }) => {
  const request = await RedemptionRequest.findById(requestId);
  if (!request) {
    const error = new Error("Không tìm thấy yêu cầu");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "pending") {
    const error = new Error("Yêu cầu đã được xử lý");
    error.statusCode = 400;
    throw error;
  }

  request.status = status;
  request.reviewedBy = adminId;
  request.reviewNote = note;
  request.reviewedAt = new Date();

  if (status === "approved") {
    // Tạo mã chứng nhận
    request.certificateNumber = `UTB OPENDICT-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Trừ điểm
    await exports.addPoints(request.user, {
      action: "redemption_training_points",
      points: request.pointsUsed,
      category: "redemption",
      description: `Đổi ${request.pointsUsed} ĐUT → ${request.trainingPointsGained} điểm rèn luyện`,
      metadata: {
        certificateNumber: request.certificateNumber,
        semester: request.semester,
      },
    });

    // Cập nhật tổng đã đổi
    const summary = await getOrCreateSummary(request.user);
    summary.totalRedeemedTrainingPoints += request.trainingPointsGained;
    // Trừ trực tiếp điểm tổng
    summary.totalPoints = Math.max(0, summary.totalPoints - request.pointsUsed);
    summary.level = determineLevel(summary.totalPoints);
    await summary.save();

    // Tạo PDF chứng nhận
    try {
      const populatedUser = await User.findById(request.user).select(
        "fullName email",
      );
      const { ReputationHistory } = require("../models/ReputationPoint");
      const history = await ReputationHistory.find({
        user: request.user,
      }).lean();
      const pdfPath = await pdfService.generateCertificate(
        request,
        populatedUser,
        history,
      );
      request.pdfPath = pdfPath;
    } catch (pdfErr) {
      // PDF generation failure không chặn approval
      console.error("PDF generation error:", pdfErr.message);
    }

    await notificationService.createNotification({
      recipient: request.user,
      type: NOTIFICATION_TYPES.REPUTATION_MILESTONE,
      title: "Yêu cầu đổi điểm đã được duyệt",
      message: `Bạn nhận +${request.trainingPointsGained} điểm rèn luyện. Mã chứng nhận: ${request.certificateNumber}`,
    });
  } else {
    await notificationService.createNotification({
      recipient: request.user,
      type: NOTIFICATION_TYPES.REPUTATION_PENALTY,
      title: "Yêu cầu đổi điểm bị từ chối",
      message: note || "Yêu cầu đổi điểm của bạn đã bị từ chối.",
    });
  }

  await request.save();
  return request;
};

exports.getRedemptionHistory = async (userId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { user: userId };

  const [requests, total] = await Promise.all([
    RedemptionRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reviewedBy", "fullName")
      .lean(),
    RedemptionRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// ==================== ANTI-FRAUD ====================

exports.checkDuplicateSubmission = async (userId, action, relatedId) => {
  const recentDuplicate = await ReputationHistory.findOne({
    user: userId,
    action,
    relatedId,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  return !!recentDuplicate;
};

exports.detectCrossAccountReports = async (reporterUserId, targetTermId) => {
  // Kiểm tra cùng thuật ngữ bị báo xấu nhiều lần bởi cùng user
  const recentReports = await ReputationHistory.countDocuments({
    user: reporterUserId,
    action: { $regex: /^report_/ },
    relatedId: targetTermId,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });
  return recentReports >= 3;
};

// ==================== QUẢN TRỊ ====================

exports.adminAdjustPoints = async (
  adminId,
  userId,
  { points, description },
) => {
  const result = await exports.addPoints(userId, {
    action: "admin_adjustment",
    points: Math.abs(points),
    category: points >= 0 ? "bonus" : "penalty",
    description: description || `Điều chỉnh bởi admin`,
    metadata: { adjustedBy: adminId },
  });

  return result;
};

exports.getAllRedemptionRequests = async (options = {}) => {
  const { page = 1, limit = 20, status } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;

  const [requests, total] = await Promise.all([
    RedemptionRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "fullName email")
      .populate("reviewedBy", "fullName")
      .lean(),
    RedemptionRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};
