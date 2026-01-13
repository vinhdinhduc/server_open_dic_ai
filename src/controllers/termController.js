const { successResponse, errorResponse } = require("../utils/response");
const termService = require("../services/termService");

exports.searchTerms = async (req, res, next) => {
  try {
    const { query, category, page, limit } = req.query;
    const result = await termService.searchTerms(query, category, page, limit);
    return successResponse(res, "Tìm kiếm thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.getTerm = async (req, res, next) => {
  try {
    const termId = req.params.id;
    const userId = req.user?._id;
    const result = await termService.getTerm(termId, userId);
    return successResponse(res, "Lấy thông tin thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.createTerm = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const termData = req.body;
    const result = await termService.createTerm(userId, termData);
    return successResponse(res, "Tạo thuật ngữ thành công", result, 201);
  } catch (error) {
    next(error);
  }
};

exports.updateTerm = async (req, res, next) => {
  try {
    const termId = req.params.id;
    const updates = req.body;
    const result = await termService.updateTerm(termId, updates);
    return successResponse(res, "Cập nhật thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.deleteTerm = async (req, res, next) => {
  try {
    const termId = req.params.id;
    await termService.deleteTerm(termId);
    return successResponse(res, "Xóa thuật ngữ thành công");
  } catch (error) {
    next(error);
  }
};
