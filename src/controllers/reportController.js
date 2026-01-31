const { successResponse } = require("../utils/response");
const reportService = require("../services/reportService");

/**
 * @route   POST /api/reports
 * @desc    Tạo báo xấu mới
 * @access  Private
 */
exports.createReport = async (req, res, next) => {
  try {
    const reportData = req.body;
    const reporterId = req.user._id;

    const report = await reportService.createReport(reportData, reporterId);

    return successResponse(res, "Báo xấu đã được gửi thành công", report, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reports
 * @desc    Lấy danh sách báo xấu (Moderator/Admin)
 * @access  Private - Moderator, Admin
 */
exports.getReports = async (req, res, next) => {
  try {
    const { status, type, category } = req.query;
    const { page, limit } = req.pagination;

    const result = await reportService.getReports(
      { page, limit, status, type, category },
      req.user,
    );

    return successResponse(res, "Lấy danh sách báo xấu thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reports/:id
 * @desc    Lấy chi tiết báo xấu
 * @access  Private - Moderator, Admin
 */
exports.getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await reportService.getReportById(id, req.user);

    return successResponse(res, "Lấy chi tiết báo xấu thành công", report);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/reports/:id/resolve
 * @desc    Xử lý báo xấu (resolve/reject)
 * @access  Private - Moderator, Admin
 */
exports.resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resolveData = req.body;
    const moderatorId = req.user._id;

    const report = await reportService.resolveReport(
      id,
      moderatorId,
      resolveData,
    );

    return successResponse(res, "Xử lý báo xấu thành công", report);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reports/stats
 * @desc    Thống kê báo xấu
 * @access  Private - Moderator, Admin
 */
exports.getReportStats = async (req, res, next) => {
  try {
    const stats = await reportService.getReportStats(req.user);

    return successResponse(res, "Lấy thống kê báo xấu thành công", stats);
  } catch (error) {
    next(error);
  }
};
