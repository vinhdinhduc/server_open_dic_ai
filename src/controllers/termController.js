const { successResponse, errorResponse } = require("../utils/response");
const termService = require("../services/termService");

exports.searchTerms = async (req, res, next) => {
  try {
    const { q, category, language, sortBy } = req.query;
    const { page, limit } = req.pagination;
    console.log("check ", q, category, language);

    const result = await termService.searchTerms(q, {
      category,
      language,
      sortBy,
      page,
      limit,
    });

    // Lưu lịch sử tìm kiếm nếu user đã đăng nhập\

    if (req.user && q) {
      await termService.saveSearchHistory(req.user._id, q, result.terms.length);
    }

    return successResponse(res, "Tìm kiếm thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};
exports.getSuggestions = async (req, res, next) => {
  try {
    const { q, language = "vi", limit = 10 } = req.query;
    if (!q || q.length < 2) {
      return errorResponse(
        res,
        "Yêu cầu chuỗi tìm kiếm có độ dài tối thiểu 2 ký tự",
        400,
      );
    }

    const suggestions = await termService.getSuggestions(q, language, limit);
    console.log("Check suggestions", suggestions);
    return successResponse(res, "Lấy gợi ý thành công", { suggestions });
  } catch (error) {
    next(error);
  }
};
exports.getTermById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const term = await termService.getTermById(id, userId);
    return successResponse(res, "Lấy chi tiết thuật ngữ thành công", term);
  } catch (error) {
    next(error);
  }
};
exports.createTerm = async (req, res, next) => {
  try {
    const termData = req.body;
    const userId = req.user._id;
    const newTerm = await termService.createTerm(termData, userId);
    return successResponse(res, "Tạo thuật ngữ thành công", newTerm, 201);
  } catch (error) {
    next(error);
  }
};

exports.updateTerm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const termData = req.body;
    const userId = req.user._id;
    const updatedTerm = await termService.updateTerm(id, termData, userId);
    return successResponse(res, "Cập nhật thuật ngữ thành công", updatedTerm);
  } catch (error) {
    next(error);
  }
};
exports.deleteTerm = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await termService.deleteTerm(id);
    return successResponse(res, "Xoá thuật ngữ thành công ", result);
  } catch (error) {
    next(error);
  }
};

exports.getTerms = async (req, res, next) => {
  try {
    const { category, language, sortBy } = req.query;
    const { page, limit } = req.pagination;
    const result = await termService.searchTerms("", {
      category,
      language,
      sortBy,
      page,
      limit,
    });
    return successResponse(res, "Lấy danh sách thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};
