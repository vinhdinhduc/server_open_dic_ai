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

const TERM_LANGUAGES = ["vi", "en", "lo"];

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNormalizedTermEntries = (term = {}) =>
  TERM_LANGUAGES.map((lang) => ({
    lang,
    value: typeof term?.[lang] === "string" ? term[lang].trim() : "",
  })).filter((entry) => entry.value.length > 0);

const toSimilarTermPayload = (termDoc, inputCategoryId, exactMatchers = []) => {
  const resolvedCategoryId = termDoc?.category?._id || termDoc?.category;
  const isSameCategory =
    inputCategoryId && resolvedCategoryId
      ? resolvedCategoryId.toString() === inputCategoryId.toString()
      : false;

  const isExactMatch = exactMatchers.some(({ lang, regex }) => {
    const value = termDoc?.term?.[lang];
    return typeof value === "string" && regex.test(value.trim());
  });

  return {
    _id: termDoc._id,
    term: termDoc.term,
    category: {
      _id: termDoc?.category?._id || termDoc?.category || null,
      name: termDoc?.category?.name || {},
      slug: termDoc?.category?.slug || "",
    },
    url: `/terms/${termDoc._id}`,
    isSameCategory,
    isExactMatch,
  };
};

const getSimilarTerms = async (termEntries, inputCategoryId) => {
  if (!Array.isArray(termEntries) || termEntries.length === 0) {
    return [];
  }

  const partialMatchers = termEntries.map(({ lang, value }) => ({
    lang,
    regex: new RegExp(escapeRegExp(value), "i"),
  }));

  const exactMatchers = termEntries.map(({ lang, value }) => ({
    lang,
    regex: new RegExp(`^${escapeRegExp(value)}$`, "i"),
  }));

  const similarDocs = await Term.find({
    status: TERM_STATUS.APPROVED,
    isDeleted: { $ne: true },
    $or: partialMatchers.map(({ lang, regex }) => ({ [`term.${lang}`]: regex })),
  })
    .select("term category")
    .populate("category", "name slug")
    .limit(10)
    .lean();

  return similarDocs
    .map((doc) => toSimilarTermPayload(doc, inputCategoryId, exactMatchers))
    .sort((a, b) => {
      if (a.isExactMatch !== b.isExactMatch) {
        return a.isExactMatch ? -1 : 1;
      }

      if (a.isSameCategory !== b.isSameCategory) {
        return a.isSameCategory ? -1 : 1;
      }

      return 0;
    })
    .slice(0, 5);
};

const buildApprovedContributionData = (contribution, overrideData = {}) => {
  const cloneMultiLang = (value) => ({
    vi: value?.vi || "",
    en: value?.en || "",
    lo: value?.lo || "",
  });

  const approvedData = {
    term: cloneMultiLang(overrideData.term || contribution.term),
    definition: cloneMultiLang(
      overrideData.definition || contribution.definition,
    ),
    detailedExplanation: cloneMultiLang(
      overrideData.detailedExplanation || contribution.detailedExplanation,
    ),
    examples: Array.isArray(overrideData.examples)
      ? overrideData.examples.map((example) => cloneMultiLang(example))
      : Array.isArray(contribution.examples)
        ? contribution.examples.map((example) => cloneMultiLang(example))
        : [],
    partOfSpeech:
      overrideData.partOfSpeech !== undefined
        ? overrideData.partOfSpeech
        : contribution.partOfSpeech,
    tags: Array.isArray(overrideData.tags)
      ? overrideData.tags
      : contribution.tags || [],
    contributorNote:
      overrideData.contributorNote !== undefined
        ? overrideData.contributorNote
        : contribution.contributorNote,
  };

  return normalizeContributionData(approvedData);
};
//Tạo đóng góp thuật ngữ mới
exports.createContribution = async (userId, contributionData) => {
  const normalizedContributionData = normalizeContributionData({
    ...contributionData,
  });

  const termEntries = getNormalizedTermEntries(normalizedContributionData.term);
  const exactMatchers = termEntries.map(({ lang, value }) => ({
    lang,
    regex: new RegExp(`^${escapeRegExp(value)}$`, "i"),
  }));

  const existingTerm =
    exactMatchers.length > 0
      ? await Term.findOne({
          category: normalizedContributionData.category,
          status: TERM_STATUS.APPROVED,
          isDeleted: { $ne: true },
          $or: exactMatchers.map(({ lang, regex }) => ({
            [`term.${lang}`]: regex,
          })),
        })
      : null;

  if (existingTerm) {
    const similarTerms = await getSimilarTerms(
      termEntries,
      normalizedContributionData.category,
    );

    const error = new Error(
      "Thuật ngữ đã tồn tại trong danh mục này. Vui lòng kiểm tra lại hoặc đóng góp gợi ý sửa nếu bạn muốn chỉnh sửa thuật ngữ hiện có.",
    );
    error.statusCode = 400;
    error.errors = {
      code: "TERM_ALREADY_EXISTS_IN_CATEGORY",
      similarTerms,
    };
    throw error;
  }

  const newContribution = await Contribution.create({
    ...normalizedContributionData,
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
  const {
    page = 1,
    limit = 20,
    status,
    category,
    contributor,
    includeDeleted = false,
    onlyDeleted = false,
  } = options;
  const skip = (page - 1) * limit;
  const query = {};

  if (onlyDeleted) {
    query.isDeleted = true;
  } else if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  // Nếu là moderator, chỉ lấy contributions trong danh mục được phép
  if (user && user.role === USER_ROLES.MODERATOR && !options.userId) {
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
exports.getContributionByUserId = async (userId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    includeDeleted = false,
    onlyDeleted = false,
  } = options;
  const skip = (page - 1) * limit;
  const query = {
    contributor: userId,
  };

  if (onlyDeleted) {
    query.isDeleted = true;
  } else if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  if (status) query.status = status;
  if (category) query.category = category;

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

  if (!contribution || contribution.isDeleted) {
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
  overrideData = {},
  user = null,
) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution || contribution.isDeleted) {
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

  const approvedData = buildApprovedContributionData(
    contribution,
    overrideData,
  );

  let term;
  if (contribution.type === "new_term") {
    term = await Term.create({
      term: approvedData.term,
      definition: approvedData.definition,
      detailedExplanation: approvedData.detailedExplanation,
      examples: approvedData.examples,
      partOfSpeech: approvedData.partOfSpeech,
      tags: approvedData.tags,
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
        term: approvedData.term,
        definition: approvedData.definition,
        detailedExplanation: approvedData.detailedExplanation,
        examples: approvedData.examples,
        partOfSpeech: approvedData.partOfSpeech,
        tags: approvedData.tags,
        lastModifiedBy: moderatorId,
      },
      { new: true },
    );
  }

  //Cập nhật contribution
  contribution.term = approvedData.term;
  contribution.definition = approvedData.definition;
  contribution.detailedExplanation = approvedData.detailedExplanation;
  contribution.examples = approvedData.examples;
  contribution.partOfSpeech = approvedData.partOfSpeech;
  contribution.tags = approvedData.tags;
  contribution.contributorNote = approvedData.contributorNote;
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
  if (!contribution || contribution.isDeleted) {
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
  contribution.isDeleted = true;
  contribution.deletedAt = new Date();
  contribution.deletedBy = moderatorId;
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

exports.deleteContribution = async (contributionId, deletedBy = null) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution || contribution.isDeleted) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }
  if (contribution.status !== CONTRIBUTION_STATUS.REJECTED) {
    const error = new Error(
      "Chỉ có thể xoá mềm đóng góp đã được kiểm duyệt và bị từ chối",
    );
    error.statusCode = 400;
    throw error;
  }

  contribution.isDeleted = true;
  contribution.deletedAt = new Date();
  contribution.deletedBy = deletedBy;
  await contribution.save();
  return {
    message: "Đã chuyển đóng góp vào thùng rác",
  };
};

exports.restoreContribution = async (contributionId) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution || !contribution.isDeleted) {
    const error = new Error("Không tìm thấy đóng góp trong thùng rác");
    error.statusCode = 404;
    throw error;
  }

  contribution.isDeleted = false;
  contribution.deletedAt = null;
  contribution.deletedBy = null;
  await contribution.save();
  return contribution;
};

exports.emptyContributionTrash = async () => {
  const result = await Contribution.deleteMany({ isDeleted: true });
  return { deletedCount: result.deletedCount || 0 };
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
