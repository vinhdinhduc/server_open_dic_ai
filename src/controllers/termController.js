const { successResponse, errorResponse } = require("../utils/response");
const termService = require("../services/termService");
const exportService = require("../services/exportService");
const importService = require("../services/importService");
const { logAudit, ACTIONS } = require("../services/auditLogService");

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
exports.incrementTermView = async (req, res, next) => {
  try {
    const { id } = req.params;
    await termService.incrementTermView(id, req.user?._id || null);
    return successResponse(res, "Cập nhật lượt xem thành công", {});
  } catch (error) {
    next(error);
  }
};
exports.createTerm = async (req, res, next) => {
  try {
    const termData = req.body;

    if (
      termData.tags &&
      typeof termData.tags === "object" &&
      !Array.isArray(termData.tags)
    ) {
      termData.tags = Object.values(termData.tags);
    }

    const userId = req.user._id;
    const newTerm = await termService.createTerm(termData, userId);
    try {
      logAudit({
        action: ACTIONS.TERM_CREATE,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "term",
          resourceId: newTerm?._id,
          resourceName:
            newTerm?.term?.vi || newTerm?.term || newTerm?.name || null,
        },
        diff: {
          before: null,
          after: termData,
        },
      });
    } catch (e) {
      /* ignore audit failure */
    }
    return successResponse(res, "Tạo thuật ngữ thành công", newTerm, 201);
  } catch (error) {
    next(error);
  }
};

exports.updateTerm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const termData = req.body;

    if (termData.status === "approve") {
      termData.status = "approved";
    }
    if (termData.status === "reject") {
      termData.status = "rejected";
    }

    if (
      termData.tags &&
      typeof termData.tags === "object" &&
      !Array.isArray(termData.tags)
    ) {
      termData.tags = Object.values(termData.tags);
    }

    const userId = req.user._id;
    const beforeTerm = await termService.getTermById(id, userId);
    const updatedTerm = await termService.updateTerm(id, termData, userId);
    const auditAction =
      termData.status === "approved"
        ? ACTIONS.TERM_APPROVE
        : termData.status === "rejected"
          ? ACTIONS.TERM_REJECT
          : ACTIONS.TERM_UPDATE;
    try {
      logAudit({
        action: auditAction,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "term",
          resourceId: updatedTerm?._id || id,
          resourceName:
            updatedTerm?.name ||
            updatedTerm?.term ||
            beforeTerm?.name ||
            beforeTerm?.term ||
            null,
        },
        diff: {
          before: {
            status: beforeTerm?.status,
            term: beforeTerm?.term,
            definition: beforeTerm?.definition,
            examples: beforeTerm?.examples,
            tags: beforeTerm?.tags,
          },
          after: {
            status: updatedTerm?.status,
            term: updatedTerm?.term,
            definition: updatedTerm?.definition,
            examples: updatedTerm?.examples,
            tags: updatedTerm?.tags,
          },
        },
        reason: req.body.moderatorNote || null,
      });
    } catch (e) {
      /* ignore audit failure */
    }
    // Fire-and-forget audit log for approval
    return successResponse(res, "Cập nhật thuật ngữ thành công", updatedTerm);
  } catch (error) {
    next(error);
  }
};
exports.deleteTerm = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await termService.deleteTerm(id, req.user?._id || null);
    // Fire-and-forget audit log for deletion
    try {
      logAudit({
        action: ACTIONS.TERM_DELETE,
        actor: {
          userId: req.user?._id,
          email: req.user?.email,
          role: req.user?.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
        target: {
          resourceType: "term",
          resourceId: id,
          resourceName: result?.name || result?.term || null,
        },
        diff: null,
      });
    } catch (e) {
      /* ignore */
    }
    return successResponse(res, "Xoá thuật ngữ thành công ", result);
  } catch (error) {
    next(error);
  }
};

exports.restoreTerm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await termService.restoreTerm(id);
    return successResponse(res, "Khôi phục thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.emptyTermTrash = async (req, res, next) => {
  try {
    const result = await termService.emptyTermTrash();
    return successResponse(
      res,
      `Đã làm rỗng thùng rác (${result.deletedCount} mục)`,
      result,
    );
  } catch (error) {
    next(error);
  }
};

exports.getTerms = async (req, res, next) => {
  try {
    const { category, status, sortBy, search, includeDeleted, onlyDeleted } =
      req.query;
    const { page, limit } = req.pagination;
    const result = await termService.getTerms({
      category,
      status,
      sortBy,
      search,
      includeDeleted: includeDeleted === "true",
      onlyDeleted: onlyDeleted === "true",
      page,
      limit,
    });
    return successResponse(res, "Lấy danh sách thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

// Moderator: Lấy thuật ngữ trong danh mục được phân công
exports.getTermsForModerator = async (req, res, next) => {
  try {
    const user = req.user;
    const { category, status, sortBy, search, includeDeleted, onlyDeleted } =
      req.query;
    const { page, limit } = req.pagination;

    let categoryIds = [];
    if (user.role === "admin") {
    } else {
      categoryIds = user.moderationPermissions?.categories?.map(String) || [];
    }

    const result = await termService.getTermsForModerator({
      categoryIds,
      category,
      status,
      sortBy,
      search,
      includeDeleted: includeDeleted === "true",
      onlyDeleted: onlyDeleted === "true",
      page,
      limit,
    });
    return successResponse(res, "Lấy danh sách thuật ngữ thành công", result);
  } catch (error) {
    next(error);
  }
};

// Quản trị: Lấy tất cả thuật ngữ kèm thống kê
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

// Quản trị viên: Lấy thống kê thuật ngữ
exports.getTermStats = async (req, res, next) => {
  try {
    const stats = await termService.getTermStats();
    return successResponse(res, "Lấy thống kê thuật ngữ thành công", { stats });
  } catch (error) {
    next(error);
  }
};

exports.exportTerms = async (req, res, next) => {
  try {
    const { category, status, search, language } = req.query;

    const result = await exportService.exportTermsToExcel({
      category,
      status,
      search,
      language,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader("X-Total-Records", result.totalRecords);

    return res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// Import thuật ngữ từ Excel/CSV
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

// Tải mẫu Excel để import
exports.downloadImportTemplate = async (req, res, next) => {
  try {
    const XLSX = require("xlsx");

    const headerRow = [
      "* Thuật ngữ (VI)",
      "Thuật ngữ (EN)",
      "Thuật ngữ (LO)",
      "* Định nghĩa (VI)",
      "Định nghĩa (EN)",
      "Định nghĩa (LO)",
      "Giải thích chi tiết (VI)",
      "Giải thích chi tiết (EN)",
      "Giải thích chi tiết (LO)",
      "Ví dụ",
      "Tags",
      "Loại từ",
      "Danh mục",
    ];

    const sampleRows = [
      [
        "Trí tuệ nhân tạo",
        "Artificial Intelligence",
        "ປັນຍາປະດິດ",
        "Lĩnh vực khoa học máy tính mô phỏng trí tuệ con người",
        "A field of computer science that simulates human intelligence",
        "",
        "Trí tuệ nhân tạo (AI) là một nhánh của khoa học máy tính...",
        "Artificial Intelligence (AI) is a branch of computer science...",
        "",
        "AI được dùng trong nhận diện khuôn mặt; Chatbot là ứng dụng AI phổ biến",
        "AI,machine learning,deep learning",
        "noun",
        "Công nghệ thông tin",
      ],
      [
        "Cơ sở dữ liệu",
        "Database",
        "",
        "Tập hợp dữ liệu có tổ chức, được lưu trữ và truy cập bằng máy tính",
        "An organized collection of data stored and accessed electronically",
        "",
        "",
        "",
        "",
        "MySQL là một hệ quản trị CSDL phổ biến",
        "database,SQL,storage",
        "noun",
        "Công nghệ thông tin",
      ],
    ];

    const instructionSheet = [
      ["HƯỚNG DẪN IMPORT THUẬT NGỮ"],
      [""],
      ["Cột bắt buộc (đánh dấu *):", "* Thuật ngữ (VI), * Định nghĩa (VI)"],
      [
        "Cột tùy chọn:",
        "Thuật ngữ (EN/LO), Định nghĩa (EN/LO), Giải thích chi tiết (VI/EN/LO), Ví dụ, Tags, Loại từ, Danh mục",
      ],
      [""],
      [
        "Loại từ (partOfSpeech):",
        "noun, verb, adjective, adverb, phrase, abbreviation",
      ],
      [
        "Danh mục:",
        "Nhập tên danh mục tiếng Việt hoặc slug. Nếu bỏ trống, dùng danh mục được chọn khi import.",
      ],
      [""],
      ["Ví dụ:", "Nhập nhiều ví dụ cách nhau bằng dấu chấm phẩy (;)"],
      ["Tags:", "Nhập nhiều tag cách nhau bằng dấu phẩy (,)"],
      [""],
      ["Lưu ý:"],
      ["- Dòng đầu tiên là tiêu đề, dữ liệu bắt đầu từ dòng 2"],
      ["- Thuật ngữ trùng trong cùng danh mục sẽ bị bỏ qua"],
      ["- Hỗ trợ định dạng: .xlsx, .xls, .csv"],
      ["- Tối đa 10MB mỗi file"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...sampleRows]);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 50 },
      { wch: 50 },
      { wch: 50 },
      { wch: 50 },
      { wch: 50 },
      { wch: 50 },
      { wch: 50 },
      { wch: 30 },
      { wch: 15 },
      { wch: 25 },
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionSheet);
    wsInstructions["!cols"] = [{ wch: 30 }, { wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Thuật ngữ");
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Hướng dẫn");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="import-template.xlsx"',
    );
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// Lưu lịch sử tìm kiếm (client-side call)
exports.saveSearchHistoryEndpoint = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { query, resultCount } = req.body;

    if (!query) {
      return errorResponse(res, "Query là bắt buộc", 400);
    }

    await termService.saveSearchHistory(userId, query, resultCount || 0);
    return successResponse(res, "Đã lưu lịch sử tìm kiếm");
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
