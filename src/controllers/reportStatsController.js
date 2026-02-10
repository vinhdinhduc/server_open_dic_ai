const { successResponse } = require("../utils/response");
const reportStatsService = require("../services/reportStatsService");

/**
 * Lấy thống kê tổng quan
 */
exports.getSystemOverview = async (req, res, next) => {
  try {
    const overview = await reportStatsService.getSystemOverview();
    return successResponse(res, "Lấy thống kê tổng quan thành công", overview);
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê thuật ngữ theo thời gian
 */
exports.getTermsOverTime = async (req, res, next) => {
  try {
    const { period = "month", months = 12 } = req.query;
    const data = await reportStatsService.getTermsOverTime(
      period,
      parseInt(months),
    );
    return successResponse(
      res,
      "Lấy thống kê thuật ngữ theo thời gian thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê người dùng theo thời gian
 */
exports.getUsersOverTime = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    const data = await reportStatsService.getUsersOverTime(parseInt(months));
    return successResponse(
      res,
      "Lấy thống kê người dùng theo thời gian thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê thuật ngữ theo danh mục
 */
exports.getTermsByCategory = async (req, res, next) => {
  try {
    const data = await reportStatsService.getTermsByCategory();
    return successResponse(
      res,
      "Lấy thống kê thuật ngữ theo danh mục thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê đóng góp theo thời gian
 */
exports.getContributionsOverTime = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    const data = await reportStatsService.getContributionsOverTime(
      parseInt(months),
    );
    return successResponse(
      res,
      "Lấy thống kê đóng góp theo thời gian thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy top người đóng góp
 */
exports.getTopContributors = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const data = await reportStatsService.getTopContributors(parseInt(limit));
    return successResponse(res, "Lấy top người đóng góp thành công", data);
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thuật ngữ được xem nhiều nhất
 */
exports.getTopViewedTerms = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const data = await reportStatsService.getTopViewedTerms(parseInt(limit));
    return successResponse(
      res,
      "Lấy thuật ngữ xem nhiều nhất thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê người dùng theo vai trò
 */
exports.getUsersByRole = async (req, res, next) => {
  try {
    const data = await reportStatsService.getUsersByRole();
    return successResponse(
      res,
      "Lấy thống kê người dùng theo vai trò thành công",
      data,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy báo cáo tổng hợp đầy đủ
 */
exports.getFullReport = async (req, res, next) => {
  try {
    const { period = "month", months = 12 } = req.query;
    const data = await reportStatsService.getFullReport({
      period,
      months: parseInt(months),
    });
    return successResponse(res, "Lấy báo cáo tổng hợp thành công", data);
  } catch (error) {
    next(error);
  }
};
