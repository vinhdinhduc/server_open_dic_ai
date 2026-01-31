const { successResponse, errorResponse } = require("../utils/response");
const Contribution = require("../models/Contribution");
const contributionService = require("../services/contributionService");

exports.createContribution = async (req, res, next) => {
  try {
    const contributionData = req.body;
    const userId = req.user._id;

    const newContribution = await contributionService.createContribution(
      userId,
      contributionData,
    );
    return successResponse(
      res,
      "Đóng góp của bạn đã được gửi và đang chờ kiểm duyệt",
      newContribution,
      201,
    );
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách đóng góp (của mình hoặc tất cả tùy role)
exports.getMyContribution = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const { page, limit } = req.pagination;
    const userRole = req.user.role;
    const userId = req.user._id;

    const options = { status, category, page, limit };
    if (userRole === "user") {
      options.userId = userId;
    }

    const result = await contributionService.getMyContribution({}, options);
    return successResponse(res, "Lấy danh sách đóng góp thành công", result);
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết đóng góp của mình

exports.getContributionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contribution = await contributionService.getContributionById(id);

    //Check quyền xem đóng góp

    const isOwner =
      contribution.contributor._id.toString() === req.user._id.toString();
    const isModerator = ["moderator", "admin"].includes(req.user.role);

    if (!isOwner && !isModerator) {
      return errorResponse(res, "Bạn không có quyền xem đóng góp này", 403);
    }

    return successResponse(
      res,
      "Lấy chi tiết đóng góp thành công",
      contribution,
    );
  } catch (error) {
    next(error);
  }
};
exports.approveContribution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moderatorNote } = req.body;
    const moderatorId = req.user._id;
    const result = await contributionService.approveContribution(
      id,
      moderatorId,
      moderatorNote,
      req.user, // Truyền user để kiểm tra quyền category
    );
    return successResponse(res, "Phê duyệt đóng góp thành công", result);
  } catch (error) {
    next(error);
  }
};
exports.rejectContribution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moderatorNote } = req.body;
    const moderatorId = req.user._id;
    if (!moderatorNote) {
      return errorResponse(res, "Vui lòng cung cấp lý do từ chối", 400);
    }
    const result = await contributionService.rejectContribution(
      id,
      moderatorId,
      moderatorNote,
      req.user, // Truyền user để kiểm tra quyền category
    );
    return successResponse(res, "Từ chối đóng góp thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/contributions/:id
 * @desc    Xóa đóng góp
 * @access  Private - Owner/Admin
 */
exports.deleteContribution = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await contributionService.deleteContribution(id);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};
