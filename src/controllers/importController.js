const { successResponse, errorResponse } = require("../utils/response");
const importService = require("../services/importService");

exports.importTerms = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, "Vui lòng upload file", 400);
    }

    const userId = req.user._id;
    const result = await importService.importFromFile(req.file, userId);

    return successResponse(res, "Import dữ liệu thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.getImportHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await importService.getImportHistory(page, limit);

    return successResponse(res, "Lấy lịch sử import thành công", result);
  } catch (error) {
    next(error);
  }
};
