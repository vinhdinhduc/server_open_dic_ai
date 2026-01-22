const Term = require("../models/Term");
const Category = require("../models/Category");
const SearchHistory = require("../models/SearchHistory");
const { TERM_STATUS } = require("../utils/constants");

exports.searchTerms = async (query, options = {}) => {
  const {
    page = 1,
    limit = 10,
    category,
    language,
    sortBy = "relevance",
  } = options;
  const skip = (page - 1) * limit;
  const searchQuery = {};

  //Tìm kiếm full-text

  if (query) {
    searchQuery.$text = { $search: query };
  }

  //filter theo category

  if (category) {
    searchQuery.category = category;
  }
  searchQuery.status = TERM_STATUS.APPROVED;

  //sort
  let sort = {};

  if (query && sortBy === "relevance") {
    sort.score = { $meta: "textScore" };
  } else if (sortBy === "popular") {
    sort.viewCount = -1;
  } else if (sortBy === "newest") {
    sort.createdAt = -1;
  }

  const [terms, total] = await Promise.all([
    Term.find(searchQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("createdBy", "fullName")
      .select(
        `term.${language} definition.${language} category viewCount favoritesCount createdAt`,
      ),
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

  // Tăng view
  term.viewCount += 1;
  await term.save();
  return term;
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

  Object.assign(term, updateData);
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
  await SearchHistory.create({
    user: userId,
    query,
    resultCount,
  });
};

//Lấy gợi ý tìm kiếm

exports.getSuggestions = async (query, language = "vi", limit = 10) => {
  const regex = new RegExp(query, "i");
  const terms = await Term.find({
    [`term.${language}`]: regex,
    status: TERM_STATUS.APPROVED,
  })
    .select(`term.${language}`)
    .limit(limit);

  return terms.map((term) => term.term[language]);
};
