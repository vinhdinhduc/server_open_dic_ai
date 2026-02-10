const { successResponse, errorResponse } = require("../utils/response");
const termService = require("../services/termService");
const exportService = require("../services/exportService");
const importService = require("../services/importService");

exports.searchTerms = async (req, res, next) => {
  try {
    const { q, category, language, sortBy } = req.query;
    const { page, limit } = req.pagination;

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
    const { category, status, sortBy, search } = req.query;
    const { page, limit } = req.pagination;
    const result = await termService.getTerms({
      category,
      status,
      sortBy,
      search,
      page,
      limit,
    });
    return successResponse(res, "Lấy danh sách thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

// Admin: Lấy tất cả terms với stats
exports.getTermsForAdmin = async (req, res, next) => {
  try {
    const { category, status, sortBy } = req.query;
    const { page, limit } = req.pagination;
    const result = await termService.getTermsForAdmin({
      category,
      status,
      sortBy,
      page,
      limit,
    });
    return successResponse(res, "Lấy danh sách thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

// Admin: Lấy thống kê thuật ngữ
exports.getTermStats = async (req, res, next) => {
  try {
    const stats = await termService.getTermStats();
    return successResponse(res, "Lấy thống kê thuật ngữ thành công", { stats });
  } catch (error) {
    next(error);
  }
};

// Export terms to Excel
exports.exportTerms = async (req, res, next) => {
  try {
    const { category, status, search, language } = req.query;

    const result = await exportService.exportTermsToExcel({
      category,
      status,
      search,
      language,
    });

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader("X-Total-Records", result.totalRecords);

    // Send buffer
    return res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// Import terms from Excel/CSV
exports.importTerms = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, "Vui lòng chọn file để nhập", 400);
    }

    const { category } = req.body;
    const userId = req.user._id;

    const result = await importService.importFromFile(
      req.file,
      userId,
      category,
    );

    return successResponse(res, "Nhập dữ liệu hoàn tất", result);
  } catch (error) {
    next(error);
  }
};

// Lấy lịch sử tìm kiếm
exports.getSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page, limit } = req.pagination;
    const result = await termService.getSearchHistory(userId, { page, limit });
    return successResponse(res, "Lấy lịch sử tìm kiếm thành công", result);
  } catch (error) {
    next(error);
  }
};

// Xóa một mục lịch sử
exports.deleteSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const result = await termService.deleteSearchHistory(userId, id);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

// Xóa toàn bộ lịch sử
exports.clearSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await termService.clearSearchHistory(userId);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};
