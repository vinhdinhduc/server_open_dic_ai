const Contribution = require("../models/Contribution");
const Term = require("../models/Term");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { CONTRIBUTION_STATUS, TERM_STATUS } = require("../utils/constants");
//Tạo đóng góp thuật ngữ mới
exports.createContribution = async (contributionData, userId) => {
  const newContribution = await Contribution.create({
    ...contributionData,
    createdBy: userId,
    status: CONTRIBUTION_STATUS.PENDING,
  });
  return newContribution;

  // Gui thong bao den admin va kiểm duyệt đóng góp mới
  //   const admins = await User.find({ role: "admin" });
};
//Get list contribution

exports.getContribution = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, status, category, contributor } = options;
  const skip = (page - 1) * limit;
  const query = {};

  if (status) query.status = status;
  if (category) query.category = category;
  if (contributor) query.contribution = contributor;

  const [contributions, total] = await Promise.all([
    await Contribution.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("contributor", "fullName email")
      .populate("category", "name")
      .populate("moderator", "fullName"),
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
) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
  }

  if (!contribution.status === CONTRIBUTION_STATUS.PENDING) {
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
      category: contribution.category,
      createdBy: contribution.contributor,
      status: TERM_STATUS.APPROVED,
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
    type: "contribution_approved",
    title: "Đóng góp được phê duyệt",
    message: `Đóng góp của bạn về thuật ngữ "${contribution.term}" đã được phê duyệt.`,
    relatedId: term._id,
    relatedModel: "Term",
  });

  return { contribution, term };
};
//Từ chối đóng góp
exports.rejectContribution = async (
  contributionId,
  moderatorId,
  moderatorNote = "",
) => {
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    const error = new Error("Không tìm thấy đóng góp");
    error.statusCode = 404;
    throw error;
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
    type: "contribution_rejected",
    title: "Đóng góp bị từ chối",
    message: `Đóng góp của bạn về thuật ngữ "${contribution.term}" đã bị từ chối. Lý do: ${moderatorNote}`,
    relatedId: contribution._id,
    relatedModel: "Contribution",
  });
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
