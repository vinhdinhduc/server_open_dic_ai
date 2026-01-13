const { successResponse, errorResponse } = require("../utils/response");
const Contribution = require("../models/Contribution");

exports.createContribution = async (req, res, next) => {
  try {
    const { type, term, data, description } = req.body;
    const userId = req.user._id;

    const contribution = await Contribution.create({
      type,
      term,
      data,
      description,
      user: userId,
    });

    return successResponse(res, "Gửi đóng góp thành công", contribution, 201);
  } catch (error) {
    next(error);
  }
};

exports.getContributions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;

    const contributions = await Contribution.find(query)
      .populate("user", "username email")
      .populate("term", "term definition")
      .populate("reviewedBy", "username")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Contribution.countDocuments(query);

    return successResponse(res, "Lấy danh sách đóng góp thành công", {
      contributions,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewContribution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;
    const reviewerId = req.user._id;

    const contribution = await Contribution.findByIdAndUpdate(
      id,
      {
        status,
        reviewNote,
        reviewedBy: reviewerId,
        reviewedAt: Date.now(),
      },
      { new: true }
    ).populate("user", "username email");

    if (!contribution) {
      return errorResponse(res, "Không tìm thấy đóng góp", 404);
    }

    return successResponse(res, "Đánh giá đóng góp thành công", contribution);
  } catch (error) {
    next(error);
  }
};
