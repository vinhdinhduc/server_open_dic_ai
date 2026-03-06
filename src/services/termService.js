const Term = require("../models/Term");
const Category = require("../models/Category");
const SearchHistory = require("../models/SearchHistory");
const { TERM_STATUS } = require("../utils/constants");
const mongoose = require("mongoose");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.searchTerms = async (query, options = {}) => {
  const {
    page = 1,
    limit = 10,
    category,
    language,
    sortBy = "relevance",
  } = options;
  const skip = (page - 1) * limit;
  const searchQuery = { status: TERM_STATUS.APPROVED };
  let sort = {};
  // Tìm kiếm bằng regex để hỗ trợ tiếng Việt và tìm từ một phần (prefix/substring)
  // $text chỉ khớp nguyên từ hoàn chỉnh nên không phù hợp khi người dùng gõ chưa hết từ
  if (query && query.trim()) {
    const trimmed = query.trim();
    const regex = new RegExp(escapeRegex(trimmed), "i");
    searchQuery.$or = [
      { "term.vi": regex },
      { "term.en": regex },
      { "term.lo": regex },
      { "definition.vi": regex },
      { "definition.en": regex },
      { "definition.lo": regex },
    ];
  }

  //filter theo category - bỏ qua nếu là "all" hoặc không có giá trị

  if (category && category !== "all") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      searchQuery.category = new mongoose.Types.ObjectId(category);
    }
  }
  if (sortBy === "popular") {
    sort.viewCount = -1;
  } else if (sortBy === "newest" || sortBy === "relevance") {
    // "relevance" được map về newest vì regex search không có text score
    sort.createdAt = -1;
  }

  const [terms, total] = await Promise.all([
    Term.find(searchQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("createdBy", "fullName")
      .populate("relatedTerms", "term definition")
      .select(
        "term definition category viewCount favoriteCount createdAt relatedTerms",
      )
      .lean(),
    Term.countDocuments(searchQuery),
  ]);

  return {
    terms,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

exports.getTerms = async (options = {}) => {
  const {
    category,
    status,
    search,
    sortBy = "newest",
    page = 1,
    limit = 10,
  } = options;
  const skip = (page - 1) * limit;
  const query = {};

  // Filter theo status - mặc định là approved nếu không có
  if (status && status !== "all") {
    query.status = status;
  } else {
    query.status = TERM_STATUS.APPROVED;
  }

  // Filter theo category
  if (category && category !== "all") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }
  }

  // Search theo term (vi, en, lo)
  if (search && search.trim().length >= 2) {
    const trimmed = search.trim();
    query.$text = { $search: trimmed };
  }

  // Sort
  let sort = {};
  if (sortBy === "popular") {
    sort.viewCount = -1;
  } else if (sortBy === "newest") {
    sort.createdAt = -1;
  } else if (sortBy === "alphabet") {
    sort["term.vi"] = 1;
  } else if (sortBy === "oldest") {
    sort.createdAt = 1;
  }

  const [terms, total] = await Promise.all([
    Term.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("createdBy", "fullName")
      .select(
        "term definition category viewCount favoriteCount commentCount status createdAt updatedAt",
      )
      .lean(),
    Term.countDocuments(query),
  ]);

  return {
    terms,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Lấy thống kê thuật ngữ
exports.getTermStats = async () => {
  const stats = await Term.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Format stats
  const formattedStats = {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  };

  stats.forEach((s) => {
    if (s._id && formattedStats.hasOwnProperty(s._id)) {
      formattedStats[s._id] = s.count;
    }
    formattedStats.total += s.count;
  });

  return formattedStats;
};

//Get detail term
exports.getTermById = async (termId, userId = null) => {
  const term = await Term.findById(termId)
    .populate("category", "name description icon")
    .populate("createdBy", "fullName email")
    .populate("relatedTerms", "term definition");

  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  return term;
};

// Tăng lượt xem thuật ngữ (gọi riêng để tránh double-count)
exports.incrementTermView = async (termId) => {
  const term = await Term.findByIdAndUpdate(
    termId,
    { $inc: { viewCount: 1 } },
    { new: false },
  );
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }
  return true;
};

//Tạo thuật ngữ mới

exports.createTerm = async (termData, userId) => {
  // Kiểm tra category tồn tại hay không

  const category = await Category.findById(termData.category);
  if (!category) {
    const error = new Error("Danh mục không tồn tại ");
    error.statusCode = 404;
    throw error;
  }

  //Kiểm tra trùng lặp
  const existingTerm = await Term.findOne({
    "term.vi": termData.term.vi,
    category: termData.category,
  });

  if (existingTerm) {
    const error = new Error("Thuật ngữ đã tồn tại trong danh mục này");
    error.statusCode = 400;
    throw error;
  }

  //Tạo mới
  const newTerm = await Term.create({
    ...termData,
    createdBy: userId,
    status: TERM_STATUS.APPROVED,
  });
  category.termCount += 1;
  await category.save();

  return newTerm;
};
//Update term

exports.updateTerm = async (termId, termData, userId) => {
  const term = await Term.findById(termId);
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  Object.assign(term, termData);
  term.lastModifiedBy = userId;
  await term.save();
  return term;
};
//xoá thuật ngữ

exports.deleteTerm = async (termId) => {
  const term = await Term.findById(termId);
  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  //Giảm term count trong category
  const category = await Category.findByIdAndUpdate(term.category, {
    $inc: { termCount: -1 },
  });
  await term.deleteOne();
  return {
    message: "Xoá thuật ngữ thành công",
  };
};

//Lưu lịch sử tìm kiếm

exports.saveSearchHistory = async (userId, query, resultCount) => {
  if (!userId) return;
  const result = await SearchHistory.create({
    user: userId,
    query,
    resultCount,
  });
  return result;
};

// Lấy lịch sử tìm kiếm của user
exports.getSearchHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    SearchHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SearchHistory.countDocuments({ user: userId }),
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Xóa một mục lịch sử tìm kiếm
exports.deleteSearchHistory = async (userId, historyId) => {
  const result = await SearchHistory.findOneAndDelete({
    _id: historyId,
    user: userId,
  });
  if (!result) {
    const error = new Error("Không tìm thấy lịch sử tìm kiếm");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Đã xoá lịch sử tìm kiếm" };
};

// Xóa toàn bộ lịch sử tìm kiếm của user
exports.clearSearchHistory = async (userId) => {
  await SearchHistory.deleteMany({ user: userId });
  return { message: "Đã xoá toàn bộ lịch sử tìm kiếm" };
};

//Lấy gợi ý tìm kiếm
exports.getSuggestions = async (query, language = "vi", limit = 10) => {
  if (!query || query.trim().length < 2) return [];
  const trimmed = query.trim();
  const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, "i");
  const terms = await Term.find(
    {
      [`term.${language}`]: prefixRegex,
      status: TERM_STATUS.APPROVED,
    },
    {
      [`term.${language}`]: 1,
    },
  )
    .limit(limit)
    .lean();
  return terms.map((t) => t.term[language]).filter(Boolean);
};
