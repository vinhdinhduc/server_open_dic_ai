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
    includeDeleted = false,
  } = options;
  const skip = (page - 1) * limit;
  const searchQuery = { status: TERM_STATUS.APPROVED };
  if (!includeDeleted) {
    searchQuery.isDeleted = { $ne: true };
  }
  let sort = {};

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
      { tags: regex },
    ];
  }

  if (category && category !== "all") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      searchQuery.category = new mongoose.Types.ObjectId(category);
    }
  }

  // For relevance sort we fetch extra results, score them, then paginate in-memory
  if (sortBy === "relevance" && query && query.trim()) {
    const trimmed = query.trim();
    const lowerQ = trimmed.toLowerCase();
    const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, "i");

    // Fetch more results for scoring (up to 200)
    const allTerms = await Term.find(searchQuery)
      .populate("category", "name slug")
      .populate("createdBy", "fullName")
      .populate("relatedTerms", "term definition")
      .select(
        "term definition category viewCount favoriteCount createdAt relatedTerms tags",
      )
      .limit(200)
      .lean();

    // Score each result
    const scored = allTerms.map((t) => {
      let score = 0;
      const langs = ["vi", "en", "lo"];

      // Term name matching (highest priority)
      for (const lang of langs) {
        const val = (t.term[lang] || "").toLowerCase();
        if (val === lowerQ) {
          score += 100; // Exact match
        } else if (prefixRegex.test(t.term[lang] || "")) {
          score += 80; // Prefix match
        } else if (val.includes(lowerQ)) {
          score += 60; // Contains in term name
        }
      }

      // Definition matching (medium priority)
      for (const lang of langs) {
        const defVal = (t.definition?.[lang] || "").toLowerCase();
        if (defVal.includes(lowerQ)) {
          score += 30;
        }
      }

      // Tags matching
      if (t.tags?.some((tag) => tag.toLowerCase().includes(lowerQ))) {
        score += 20;
      }

      // Popularity boost (minor)
      score += Math.min((t.viewCount || 0) * 0.01, 5);

      return { ...t, _relevanceScore: score };
    });

    // Sort by score descending, then by viewCount
    scored.sort(
      (a, b) =>
        b._relevanceScore - a._relevanceScore ||
        (b.viewCount || 0) - (a.viewCount || 0),
    );

    const total = scored.length;
    const paginated = scored.slice(skip, skip + limit);

    return {
      terms: paginated,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Non-relevance sorts
  if (sortBy === "popular") {
    sort.viewCount = -1;
  } else {
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
    includeDeleted = false,
    onlyDeleted = false,
  } = options;
  const skip = (page - 1) * limit;
  const query = {};

  if (onlyDeleted) {
    query.isDeleted = true;
  } else if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

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

// Lấy danh sách thuật ngữ cho moderator (chỉ trong danh mục được phân công)
exports.getTermsForModerator = async (options = {}) => {
  const {
    categoryIds = [],
    category,
    status,
    search,
    sortBy = "newest",
    page = 1,
    limit = 10,
    includeDeleted = false,
    onlyDeleted = false,
  } = options;
  const skip = (page - 1) * limit;
  const query = {};

  if (onlyDeleted) {
    query.isDeleted = true;
  } else if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  // Restrict to moderator's assigned categories
  if (categoryIds.length > 0) {
    const validIds = categoryIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    // If user further filters to a specific category, intersect with assigned list
    if (
      category &&
      category !== "all" &&
      mongoose.Types.ObjectId.isValid(category)
    ) {
      const requested = new mongoose.Types.ObjectId(category);
      const isAssigned = validIds.some((id) => id.equals(requested));
      query.category = isAssigned ? requested : { $in: [] }; // empty result if not assigned
    } else {
      query.category = { $in: validIds };
    }
  }

  // Filter by status (moderator can see all statuses)
  if (status && status !== "all") {
    query.status = status;
  }

  // Search
  if (search && search.trim().length >= 2) {
    const trimmed = search.trim();
    query.$text = { $search: trimmed };
  }

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
      $match: {
        isDeleted: { $ne: true },
      },
    },
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
    .populate("lastModifiedBy", "fullName email")
    .populate("relatedTerms", "term definition");

  if (!term || term.isDeleted) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  return term;
};

// Tăng lượt xem thuật ngữ (gọi riêng để tránh double-count)
exports.incrementTermView = async (termId, userId = null) => {
  const term = await Term.findByIdAndUpdate(
    termId,
    { $inc: { viewCount: 1 } },
    { new: true },
  ).select("term");

  if (!term) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  if (userId) {
    const query = term.term?.vi || term.term?.en || term.term?.lo;

    if (query) {
      try {
        await exports.saveSearchHistory(userId, query, 1);
      } catch (error) {
        // View count should still succeed even if history write fails.
        console.error("Error saving search history from term view:", error);
      }
    }
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
    isDeleted: { $ne: true },
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

exports.deleteTerm = async (termId, deletedBy = null) => {
  const term = await Term.findById(termId);
  if (!term || term.isDeleted) {
    const error = new Error("Không tìm thấy thuật ngữ");
    error.statusCode = 404;
    throw error;
  }

  //Giảm term count trong category
  await Category.findByIdAndUpdate(term.category, {
    $inc: { termCount: -1 },
  });

  term.isDeleted = true;
  term.deletedAt = new Date();
  term.deletedBy = deletedBy;
  await term.save();

  return {
    message: "Đã chuyển thuật ngữ vào thùng rác",
  };
};

exports.restoreTerm = async (termId) => {
  const term = await Term.findById(termId);
  if (!term || !term.isDeleted) {
    const error = new Error("Không tìm thấy thuật ngữ trong thùng rác");
    error.statusCode = 404;
    throw error;
  }

  await Category.findByIdAndUpdate(term.category, {
    $inc: { termCount: 1 },
  });

  term.isDeleted = false;
  term.deletedAt = null;
  term.deletedBy = null;
  await term.save();

  return term;
};

exports.emptyTermTrash = async () => {
  const result = await Term.deleteMany({ isDeleted: true });
  return { deletedCount: result.deletedCount || 0 };
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

//Lấy gợi ý tìm kiếm (tìm trên tất cả ngôn ngữ) - trả về objects có thông tin category
exports.getSuggestions = async (query, language = "vi", limit = 10) => {
  if (!query || query.trim().length < 2) return [];
  const trimmed = query.trim();
  const lowerQ = trimmed.toLowerCase();
  const prefixRegex = new RegExp(`^${escapeRegex(trimmed)}`, "i");
  const containsRegex = new RegExp(escapeRegex(trimmed), "i");

  const terms = await Term.find(
    {
      $or: [
        { "term.vi": prefixRegex },
        { "term.en": prefixRegex },
        { "term.lo": prefixRegex },
        { "term.vi": containsRegex },
        { "term.en": containsRegex },
        { "term.lo": containsRegex },
        { "definition.vi": containsRegex },
        { "definition.en": containsRegex },
        { "definition.lo": containsRegex },
        { tags: containsRegex },
      ],
      status: TERM_STATUS.APPROVED,
      isDeleted: { $ne: true },
    },
    {
      "term.vi": 1,
      "term.en": 1,
      "term.lo": 1,
      "definition.vi": 1,
      "definition.en": 1,
      "definition.lo": 1,
      category: 1,
      tags: 1,
    },
  )
    .populate("category", "name icon slug")
    .limit(limit * 3)
    .lean();

  const suggestions = [];
  const seen = new Set();

  for (const t of terms) {
    if (seen.has(t._id.toString())) continue;

    let matchedField = null;
    let score = 0;

    // 1. Term name matching (highest priority)
    for (const lang of ["vi", "en", "lo"]) {
      const val = (t.term[lang] || "").toLowerCase();
      if (val === lowerQ) {
        score = Math.max(score, 100);
        matchedField = matchedField || `term.${lang}`;
      } else if (prefixRegex.test(t.term[lang] || "")) {
        score = Math.max(score, 80);
        matchedField = matchedField || `term.${lang}`;
      } else if (val.includes(lowerQ)) {
        score = Math.max(score, 60);
        matchedField = matchedField || `term.${lang}`;
      }
    }

    // 2. Definition matching (medium priority)
    if (!matchedField) {
      for (const lang of ["vi", "en", "lo"]) {
        const defVal = (t.definition?.[lang] || "").toLowerCase();
        if (defVal.includes(lowerQ)) {
          score = Math.max(score, 30);
          matchedField = `definition.${lang}`;
          break;
        }
      }
    }

    // 3. Tags matching (lower priority)
    if (!matchedField && t.tags?.some((tag) => containsRegex.test(tag))) {
      score = 20;
      matchedField = "tags";
    }

    if (matchedField) {
      seen.add(t._id.toString());
      suggestions.push({
        _id: t._id,
        term: t.term,
        category: t.category,
        matchedField,
        _score: score,
      });
    }
  }

  // Sort by score descending
  suggestions.sort((a, b) => b._score - a._score);
  return suggestions.slice(0, limit);
};
