const XLSX = require("xlsx");
const Term = require("../models/Term");
const User = require("../models/User");

/**
 * Export terms to Excel buffer
 * @param {Object} options - Export options
 * @returns {Buffer} Excel file buffer
 */
exports.exportTermsToExcel = async (options = {}) => {
  const {
    category,
    status,
    search,
    columns = "all",
    language = "all",
  } = options;

  // Build query
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (category && category !== "all") {
    query.category = category;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { "term.vi": searchRegex },
      { "term.en": searchRegex },
      { "term.lo": searchRegex },
      { "definition.vi": searchRegex },
      { "definition.en": searchRegex },
    ];
  }

  // Fetch all matching terms
  const terms = await Term.find(query)
    .sort({ createdAt: -1 })
    .populate("category", "name slug")
    .populate("createdBy", "fullName email")
    .lean();

  // Define columns based on options
  let headerRow = [];
  let dataRows = [];

  if (language === "all") {
    headerRow = [
      "STT",
      "Thuật ngữ (VI)",
      "Thuật ngữ (EN)",
      "Thuật ngữ (LO)",
      "Định nghĩa (VI)",
      "Định nghĩa (EN)",
      "Định nghĩa (LO)",
      "Giải thích chi tiết (VI)",
      "Giải thích chi tiết (EN)",
      "Giải thích chi tiết (LO)",
      "Danh mục",
      "Từ loại",
      "Tags",
      "Trạng thái",
      "Lượt xem",
      "Yêu thích",
      "Bình luận",
      "Người tạo",
      "Email người tạo",
      "Ngày tạo",
      "Ngày cập nhật",
    ];

    dataRows = terms.map((term, index) => [
      index + 1,
      term.term?.vi || "",
      term.term?.en || "",
      term.term?.lo || "",
      term.definition?.vi || "",
      term.definition?.en || "",
      term.definition?.lo || "",
      term.detailedExplanation?.vi || "",
      term.detailedExplanation?.en || "",
      term.detailedExplanation?.lo || "",
      term.category?.name?.vi || term.category?.name || "",
      getPartOfSpeechLabel(term.partOfSpeech),
      (term.tags || []).join(", "),
      getStatusLabel(term.status),
      term.viewCount || 0,
      term.favoriteCount || 0,
      term.commentCount || 0,
      term.createdBy?.fullName || "",
      term.createdBy?.email || "",
      formatDate(term.createdAt),
      formatDate(term.updatedAt),
    ]);
  } else {
    // Xuất theo một ngôn ngữ
    const langLabel =
      language === "vi" ? "Tiếng Việt" : language === "en" ? "English" : "ລາວ";

    headerRow = [
      "STT",
      `Thuật ngữ (${langLabel})`,
      `Định nghĩa (${langLabel})`,
      `Giải thích chi tiết (${langLabel})`,
      "Danh mục",
      "Từ loại",
      "Tags",
      "Trạng thái",
      "Lượt xem",
      "Yêu thích",
      "Người tạo",
      "Ngày tạo",
    ];

    dataRows = terms.map((term, index) => [
      index + 1,
      term.term?.[language] || "",
      term.definition?.[language] || "",
      term.detailedExplanation?.[language] || "",
      term.category?.name?.vi || term.category?.name || "",
      getPartOfSpeechLabel(term.partOfSpeech),
      (term.tags || []).join(", "),
      getStatusLabel(term.status),
      term.viewCount || 0,
      term.favoriteCount || 0,
      term.createdBy?.fullName || "",
      formatDate(term.createdAt),
    ]);
  }

  // Tạo worksheet

  const wsData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Thiết lập độ rộng cột
  const colWidths = headerRow.map((header, i) => {
    // if (header.includes("Định nghĩa") || header.includes("Giải thích")) {
    //   return { wch: 50 };
    // }

    if (header.includes("Định ngĩa") || header.includes("Giải thích")) {
      return { wch: 50 };
    }
    if (header.includes("Thuật ngữ")) {
      return { wch: 25 };
    }
    if (
      header === "STT" ||
      header === "Lượt xem" ||
      header === "Yêu thích" ||
      header === "Bình luận"
    ) {
      return { wch: 10 };
    }
    return { wch: 20 };
  });
  ws["!cols"] = colWidths;

  // Tạo workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Thuật ngữ");

  // Add summary sheet
  const summaryData = [
    ["Thống kê xuất dữ liệu"],
    [""],
    ["Tổng số thuật ngữ", terms.length],
    ["Ngày xuất", formatDate(new Date())],
    ["Bộ lọc danh mục", category || "Tất cả"],
    ["Bộ lọc trạng thái", status || "Tất cả"],
    ["Từ khóa tìm kiếm", search || "Không có"],
    ["Ngôn ngữ", language === "all" ? "Tất cả" : language.toUpperCase()],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Thống kê");

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    buffer,
    filename: `thuat-ngu-${formatDateFilename(new Date())}.xlsx`,
    totalRecords: terms.length,
  };
};

// Các hàm hỗ trợ
function getPartOfSpeechLabel(pos) {
  const labels = {
    noun: "Danh từ",
    verb: "Động từ",
    adjective: "Tính từ",
    adverb: "Trạng từ",
    phrase: "Cụm từ",
    abbreviation: "Từ viết tắt",
  };
  return labels[pos] || pos || "";
}

function getStatusLabel(status) {
  const labels = {
    approved: "Đã duyệt",
    pending: "Chờ duyệt",
    rejected: "Từ chối",
  };
  return labels[status] || status || "";
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateFilename(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}
exports.exportUsersToExcel = async () => {
  const users = await User.find().lean();
  const headerRows = [
    "STT",
    "Họ và tên",
    "Email",
    "Vai trò",
    "Trạng thái",
    "Ngày tạo",
    "Số thuật ngữ đã đóng góp",
  ];
  const dataRows = users.map((user, index) => [
    index + 1,
    user.fullName || "",
    user.email || "",
    user.role,
    user.status,
    formatDate(user.createdAt),
    user.contributedTermsCount || 0,
  ]);

  const wsData = [headerRows, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = headerRows.map((header) => {
    if (header === "STT" || header === "Số thuật ngữ đã đóng góp") {
      return { wch: 10 };
    }
    if (header === "Email") {
      return { wch: 30 };
    }
    return { wch: 20 };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Người dùng");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    buffer,
    filename: `nguoi-dung-${formatDateFilename(new Date())}.xlsx`,
    totalRecords: users.length,
  };
};
