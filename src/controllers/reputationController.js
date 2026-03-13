const { successResponse } = require("../utils/response");
const reputationService = require("../services/reputationService");
const pdfService = require("../services/pdfService");
const path = require("path");

/**
 * @route   GET /api/reputation/me
 * @desc    Lấy điểm uy tín của user hiện tại
 * @access  Private
 */
exports.getMyReputation = async (req, res, next) => {
  try {
    const result = await reputationService.getUserReputation(req.user._id);
    return successResponse(res, "Lấy điểm uy tín thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/history
 * @desc    Lấy lịch sử điểm uy tín của user
 * @access  Private
 */
exports.getMyHistory = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 20 };
    const { category } = req.query;
    const result = await reputationService.getReputationHistory(req.user._id, {
      page,
      limit,
      category,
    });
    return successResponse(res, "Lấy lịch sử điểm thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/leaderboard
 * @desc    Bảng xếp hạng ĐUT
 * @access  Public
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 20 };
    const result = await reputationService.getLeaderboard({ page, limit });
    return successResponse(res, "Lấy bảng xếp hạng thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/users/:userId
 * @desc    Lấy điểm uy tín của user khác (admin)
 * @access  Private - Admin
 */
exports.getUserReputation = async (req, res, next) => {
  try {
    const result = await reputationService.getUserReputation(req.params.userId);
    return successResponse(res, "Lấy điểm uy tín thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reputation/admin/adjust
 * @desc    Admin điều chỉnh điểm
 * @access  Private - Admin
 */
exports.adminAdjust = async (req, res, next) => {
  try {
    const { userId, points, description } = req.body;
    const result = await reputationService.adminAdjustPoints(
      req.user._id,
      userId,
      {
        points,
        description,
      },
    );
    return successResponse(res, "Điều chỉnh điểm thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/ai-access
 * @desc    Kiểm tra quyền truy cập AI
 * @access  Private
 */
exports.checkAIAccess = async (req, res, next) => {
  try {
    const { feature } = req.query;
    const result = await reputationService.checkAIAccess(req.user._id, feature);
    return successResponse(res, "Kiểm tra quyền AI thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reputation/verify-utb
 * @desc    Xác minh sinh viên ĐHTB
 * @access  Private
 */
exports.verifyUtb = async (req, res, next) => {
  try {
    const result = await reputationService.verifyUtbStudent(req.user._id);
    return successResponse(res, "Xác minh sinh viên ĐHTB thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reputation/redeem
 * @desc    Yêu cầu đổi điểm rèn luyện
 * @access  Private
 */
exports.requestRedemption = async (req, res, next) => {
  try {
    const { type, semester, studentId, studentClass, faculty, phone } =
      req.body;
    const result = await reputationService.requestRedemption(req.user._id, {
      type,
      semester,
      studentId,
      studentClass,
      faculty,
      phone,
    });
    return successResponse(res, "Gửi yêu cầu đổi điểm thành công", result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/redemptions
 * @desc    Lịch sử đổi điểm của user
 * @access  Private
 */
exports.getMyRedemptions = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 10 };
    const result = await reputationService.getRedemptionHistory(req.user._id, {
      page,
      limit,
    });
    return successResponse(res, "Lấy lịch sử đổi điểm thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reputation/admin/redemptions
 * @desc    Danh sách yêu cầu đổi điểm (admin)
 * @access  Private - Admin
 */
exports.getAllRedemptions = async (req, res, next) => {
  try {
    const { page, limit } = req.pagination || { page: 1, limit: 20 };
    const { status } = req.query;
    const result = await reputationService.getAllRedemptionRequests({
      page,
      limit,
      status,
    });
    return successResponse(
      res,
      "Lấy danh sách yêu cầu đổi điểm thành công",
      result,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/reputation/admin/redemptions/:id
 * @desc    Duyệt/từ chối yêu cầu đổi điểm
 * @access  Private - Admin
 */
exports.reviewRedemption = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const result = await reputationService.reviewRedemption(
      req.params.id,
      req.user._id,
      { status, note },
    );
    return successResponse(res, "Xử lý yêu cầu đổi điểm thành công", result);
  } catch (error) {
    next(error);
  }
};
/**
 * @route   GET /api/reputation/redemptions/:id/certificate
 * @route   GET /api/reputation/admin/redemptions/:id/certificate
 * @desc    Tải file PDF giấy xác nhận đổi điểm
 * @access  Private (owner) + Admin
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { RedemptionRequest } = require("../models/ReputationPoint");
    const request = await RedemptionRequest.findById(req.params.id);
    if (!request) {
      const err = new Error("Không tìm thấy yêu cầu");
      err.statusCode = 404;
      return next(err);
    }

    // Kiểm tra quyền: chỉ chủ sở hoặc admin/moderator
    const isOwner = request.user.toString() === req.user._id.toString();
    const isAdmin = ["admin", "moderator"].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      const err = new Error("Không có quyền truy cập");
      err.statusCode = 403;
      return next(err);
    }

    if (request.status !== "approved" || !request.certificateNumber) {
      const err = new Error(
        "Yêu cầu chưa được duyệt hoặc chưa có giấy xác nhận",
      );
      err.statusCode = 400;
      return next(err);
    }

    // Tìm file PDF
    let filePath =
      request.pdfPath ||
      pdfService.getCertificatePath(request.certificateNumber);

    // Nếu file chưa tồn tại, tạo lại
    if (!filePath) {
      const User = require("../models/User");
      const { ReputationHistory } = require("../models/ReputationPoint");
      const user = await User.findById(request.user).select("fullName email");
      const history = await ReputationHistory.find({
        user: request.user,
      }).lean();
      filePath = await pdfService.generateCertificate(request, user, history);
      request.pdfPath = filePath;
      await request.save();
    }

    const fileName = path.basename(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.sendFile(filePath, (err) => {
      if (err) next(err);
    });
  } catch (error) {
    next(error);
  }
};
