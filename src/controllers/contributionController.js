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
    const { status, category, includeDeleted, onlyDeleted, mine } = req.query;
    const { page, limit } = req.pagination;
    const userRole = req.user.role;
    const userId = req.user._id;

    const options = {
      status,
      category,
      page,
      limit,
      includeDeleted: includeDeleted === "true",
      onlyDeleted: onlyDeleted === "true",
      mine: mine === "true",
    };
    if (userRole === "user" || mine === "true") {
      options.userId = userId;
    }

    const result = await contributionService.getContribution(
      {},
      options,
      req.user,
    );
    return successResponse(res, "Lấy danh sách đóng góp thành công", result);
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách đóng góp của chính user cho trang profile
exports.getProfileContributions = async (req, res, next) => {
  try {
    const { status, category, includeDeleted, onlyDeleted } = req.query;
    const { page, limit } = req.pagination;

    const result = await contributionService.getContributionByUserId(
      req.user._id,
      {
        status,
        category,
        page,
        limit,
        includeDeleted: includeDeleted === "true",
        onlyDeleted: onlyDeleted === "true",
      },
    );

    return successResponse(
      res,
      "Lấy danh sách đóng góp cá nhân thành công",
      result,
    );
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

    const result = await contributionService.deleteContribution(
      id,
      req.user?._id || null,
    );

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

exports.restoreContribution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await contributionService.restoreContribution(id);
    return successResponse(res, "Khôi phục đóng góp thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.emptyContributionTrash = async (req, res, next) => {
  try {
    const result = await contributionService.emptyContributionTrash();
    return successResponse(
      res,
      `Đã làm rỗng thùng rác đóng góp (${result.deletedCount} mục)`,
      result,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk approve contributions
 */
exports.bulkApprove = async (req, res, next) => {
  try {
    const { ids, moderatorNote } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, "Vui lòng chọn ít nhất một đóng góp", 400);
    }
    if (ids.length > 50) {
      return errorResponse(res, "Tối đa 50 đóng góp mỗi lần", 400);
    }
    const result = await contributionService.bulkApprove(
      ids,
      req.user._id,
      moderatorNote || "",
      req.user,
    );
    return successResponse(
      res,
      `Đã phê duyệt ${result.success} đóng góp`,
      result,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk reject contributions
 */
exports.bulkReject = async (req, res, next) => {
  try {
    const { ids, moderatorNote } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, "Vui lòng chọn ít nhất một đóng góp", 400);
    }
    if (!moderatorNote) {
      return errorResponse(res, "Vui lòng cung cấp lý do từ chối", 400);
    }
    if (ids.length > 50) {
      return errorResponse(res, "Tối đa 50 đóng góp mỗi lần", 400);
    }
    const result = await contributionService.bulkReject(
      ids,
      req.user._id,
      moderatorNote,
      req.user,
    );
    return successResponse(
      res,
      `Đã từ chối ${result.success} đóng góp`,
      result,
    );
  } catch (error) {
    next(error);
  }
};
