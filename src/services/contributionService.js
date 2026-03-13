const Contribution = require("../models/Contribution");
const Term = require("../models/Term");
const User = require("../models/User");
const Notification = require("../models/Notification");
const emailService = require("./emailService");
const notificationService = require("./notificationService");
const reputationService = require("./reputationService");
const { normalizeContributionData } = require("../utils/helpers");
const {
  CONTRIBUTION_STATUS,
  TERM_STATUS,
  USER_ROLES,
  NOTIFICATION_TYPES,
} = require("../utils/constants");
//Tạo đóng góp thuật ngữ mới
exports.createContribution = async (userId, contributionData) => {
  const newContribution = await Contribution.create({
    ...normalizeContributionData(contributionData),
    contributor: userId,
    status: CONTRIBUTION_STATUS.PENDING,
  });

  // Lấy thông tin contributor và gửi email cho admin
  const contributor = await User.findById(userId).select("fullName email");

  // Gửi email thông báo cho admin (không chờ kết quả)

  emailService
    .sendNewContributionNotificationToAdmins(contributionData, contributor)
    .catch((err) => {
      console.error("Failed to send admin notification:", err);
    });

  // Gửi thông báo in-app cho moderator/admin phụ trách danh mục
  notificationService
    .notifyModeratorsForCategory(contributionData.category, {
      type: NOTIFICATION_TYPES.CONTRIBUTION_NEW,
      title: "Đóng góp mới cần kiểm duyệt",
      message: `Có đóng góp mới từ "${contributor?.fullName || "Người dùng"}" - ${contributionData.type === "new_term" ? "Thêm từ mới" : "Gợi ý sửa từ"}: "${contributionData.term?.vi || contributionData.term?.en || contributionData.term?.lo || ""}". Vui lòng kiểm duyệt.`,
      relatedId: newContribution._id,
      relatedModel: "Contribution",
      actionUrl: "/admin/moderation/contributions",
    })
    .catch((err) => {
      console.error("Failed to notify moderators about new contribution:", err);
    });

  // Cộng điểm uy tín khi gửi đóng góp
  if (contributionData.type === "new_term") {
    reputationService
      .onTermSubmitted(userId, newContribution._id)
      .catch(console.error);
  } else {
    reputationService
      .onEditSubmitted(userId, newContribution._id)
      .catch(console.error);
  }

  return newContribution;
};
//Get list contribution

exports.getContribution = async (filter = {}, options = {}, user = null) => {
  const { page = 1, limit = 20, status, category, contributor } = options;
  const skip = (page - 1) * limit;
  const query = {};

  // Nếu là moderator, chỉ lấy contributions trong danh mục được phép
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    if (allowedCategories.length === 0) {
      return {
        contributions: [],
        pagination: { page, limit, total: 0, pages: 0 },
      };
    }
    query.category = { $in: allowedCategories };
  }

  if (options.userId) query.contributor = options.userId;
  if (status) query.status = status;
  if (category) query.category = category;
  if (contributor) query.contributor = contributor;

  const [contributions, total] = await Promise.all([
    Contribution.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("contributor", "fullName email")
      .populate("category", "name")
      .populate("moderator", "fullName")
      .populate(
        "targetTerm",
        "term definition detailedExplanation examples partOfSpeech tags slug",
      ),
    Contribution.countDocuments(query),
  ]);

  return {
    contributions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

//Lấy chi tiết đóng góp

exports.getContributionById = async (contributionId) => {
  const contribution = await Contribution.findById(contributionId)
    .populate("contributor", "fullName email")
    .populate("category", "name description")
    .populate("moderator", "fullName ")
    .populate("targetTerm");

  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }
  return contribution;
};
//Phê duyệt đóng góp

exports.approveContribution = async (
  contributionId,
  moderatorId,
  moderatorNote = "",
  user = null,
) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền category cho moderator
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) => cat.toString() === contribution.category.toString(),
    );
    if (!isAllowed) {
      const error = new Error(
        "Bạn không có quyền kiểm duyệt đóng góp trong danh mục này",
      );
      error.statusCode = 403;
      throw error;
    }
  }

  if (contribution.status !== CONTRIBUTION_STATUS.PENDING) {
    const error = new Error("Đóng góp đã được xử lý");
    error.statusCode = 400;
    throw error;
  }

  let term;
  if (contribution.type === "new_term") {
    term = await Term.create({
      term: contribution.term,
      definition: contribution.definition,
      detailedExplanation: contribution.detailedExplanation,
      examples: contribution.examples,
      partOfSpeech: contribution.partOfSpeech,
      tags: contribution.tags,
      category: contribution.category,
      createdBy: contribution.contributor,
      status: TERM_STATUS.APPROVED,
      sourceType: "user_contribution",
    });
    //Tăng contribution count của user
    await User.findByIdAndUpdate(contribution.contributor, {
      $inc: { contributionCount: 1 },
    });
  } else {
    term = await Term.findByIdAndUpdate(
      contribution.targetTerm,
      {
        term: contribution.term,
        definition: contribution.definition,
        detailedExplanation: contribution.detailedExplanation,
        examples: contribution.examples,
        partOfSpeech: contribution.partOfSpeech,
        tags: contribution.tags,
        lastModifiedBy: contribution.contributor,
      },
      { new: true },
    );
  }

  //Cập nhật contribution
  contribution.status = CONTRIBUTION_STATUS.APPROVED;
  contribution.moderator = moderatorId;
  contribution.moderatorNote = moderatorNote;
  contribution.moderatedAt = new Date();

  await contribution.save();

  await Notification.create({
    recipient: contribution.contributor,
    type: NOTIFICATION_TYPES.CONTRIBUTION_APPROVED,
    title: "Đóng góp được phê duyệt",
    message: `Đóng góp của bạn về thuật ngữ "${contribution.term?.vi || contribution.term?.en || contribution.term?.lo || ""}" đã được phê duyệt.${moderatorNote ? " Ghi chú: " + moderatorNote : ""}`,
    relatedId: term._id,
    relatedModel: "Term",
    actionUrl: `/terms/${term._id}`,
  });

  // Lấy thông tin user và gửi email
  const contributorInfo = await User.findById(contribution.contributor).select(
    "fullName email",
  );
  if (contributorInfo) {
    emailService
      .sendContributionApprovedEmail(
        contributorInfo.email,
        contributorInfo.fullName,
        {
          type: contribution.type,
          termName:
            contribution.term?.vi ||
            contribution.term?.en ||
            contribution.term?.lo ||
            "",
          moderatorNote: moderatorNote,
        },
      )
      .catch((err) => {
        console.error("Failed to send approval email:", err);
      });
  }

  // Cộng điểm uy tín khi duyệt
  if (contribution.type === "new_term") {
    reputationService
      .onTermApproved(contribution.contributor, term._id)
      .catch(console.error);
  } else {
    reputationService
      .onEditApproved(contribution.contributor, contribution._id)
      .catch(console.error);
  }

  return { contribution, term };
};
//Từ chối đóng góp
exports.rejectContribution = async (
  contributionId,
  moderatorId,
  moderatorNote = "",
  user = null,
) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền category cho moderator
  if (user && user.role === USER_ROLES.MODERATOR) {
    const allowedCategories = user.moderationPermissions?.categories || [];
    const isAllowed = allowedCategories.some(
      (cat) => cat.toString() === contribution.category.toString(),
    );
    if (!isAllowed) {
      const error = new Error(
        "Bạn không có quyền kiểm duyệt đóng góp trong danh mục này",
      );
      error.statusCode = 403;
      throw error;
    }
  }

  if (contribution.status !== CONTRIBUTION_STATUS.PENDING) {
    const error = new Error("Đóng góp đã được xử lý");
    error.statusCode = 400;
    throw error;
  }

  contribution.status = CONTRIBUTION_STATUS.REJECTED;
  contribution.moderator = moderatorId;
  contribution.moderatorNote = moderatorNote;
  contribution.moderatedAt = new Date();
  await contribution.save();

  //Send thông báo cho kiểm duyệt viên và admin
  await Notification.create({
    recipient: contribution.contributor,
    type: NOTIFICATION_TYPES.CONTRIBUTION_REJECTED,
    title: "Đóng góp bị từ chối",
    message: `Đóng góp của bạn về thuật ngữ "${contribution.term?.vi || contribution.term?.en || contribution.term?.lo || ""}" đã bị từ chối. Lý do: ${moderatorNote}`,
    relatedId: contribution._id,
    relatedModel: "Contribution",
    actionUrl: `/contribute`,
  });

  // Lấy thông tin user và gửi email
  const contributorInfo = await User.findById(contribution.contributor).select(
    "fullName email",
  );
  if (contributorInfo) {
    emailService
      .sendContributionRejectedEmail(
        contributorInfo.email,
        contributorInfo.fullName,
        {
          type: contribution.type,
          termName:
            contribution.term?.vi ||
            contribution.term?.en ||
            contribution.term?.lo ||
            "",
          moderatorNote: moderatorNote,
        },
      )
      .catch((err) => {
        console.error("Failed to send rejection email:", err);
      });
    // Trừ điểm uy tín khi bị từ chối (spam/phá hoại)
    if (contribution.type === "new_term") {
      reputationService
        .onTermRejectedSpam(contribution.contributor, contribution._id)
        .catch(console.error);
    } else {
      reputationService
        .onEditRejectedSabotage(contribution.contributor, contribution._id)
        .catch(console.error);
    }
  }

  return contribution;
};

//Xoá đóng góp đã duyệt

exports.deleteContribution = async (contributionId) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }
  if (contribution.status !== CONTRIBUTION_STATUS.PENDING) {
    const error = new Error("Chỉ có thể xoá đóng góp đang chờ duyệt");
    error.statusCode = 400;
    throw error;
  }

  await contribution.deleteOne();
  return {
    message: "Xoá đóng góp thành công",
  };
};

// Bulk approve contributions
exports.bulkApprove = async (
  contributionIds,
  moderatorId,
  moderatorNote = "",
  user = null,
) => {
  const results = { success: 0, failed: 0, errors: [] };

  for (const id of contributionIds) {
    try {
      await exports.approveContribution(id, moderatorId, moderatorNote, user);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ id, error: err.message });
    }
  }

  return results;
};

// Bulk reject contributions
exports.bulkReject = async (
  contributionIds,
  moderatorId,
  moderatorNote = "",
  user = null,
) => {
  const results = { success: 0, failed: 0, errors: [] };

  for (const id of contributionIds) {
    try {
      await exports.rejectContribution(id, moderatorId, moderatorNote, user);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ id, error: err.message });
    }
  }

  return results;
};
