const Term = require("../models/Term");
const SearchHistory = require("../models/SearchHistory");

exports.searchTerms = async (query, category, page = 1, limit = 10) => {
  const searchQuery = {};

  if (query) {
    searchQuery.$or = [
      { term: new RegExp(query, "i") },
      { definition: new RegExp(query, "i") },
    ];
  }

  if (category) {
    searchQuery.categories = category;
  }

  searchQuery.status = "approved";

  const terms = await Term.find(searchQuery)
    .populate("categories", "name")
    .populate("createdBy", "username")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const count = await Term.countDocuments(searchQuery);

  return {
    terms,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
  };
};

exports.getTerm = async (termId, userId) => {
  const term = await Term.findById(termId)
    .populate("categories", "name")
    .populate("createdBy", "username avatar")
    .populate("relatedTerms", "term definition");

  if (!term) {
    throw new Error("Không tìm thấy thuật ngữ");
  }

  // Tăng view count
  term.viewCount += 1;
  await term.save();

  return { term };
};

exports.createTerm = async (userId, termData) => {
  const term = await Term.create({
    ...termData,
    createdBy: userId,
  });

  await term.populate("categories", "name");

  return { term };
};

exports.updateTerm = async (termId, updates) => {
  const term = await Term.findByIdAndUpdate(termId, updates, {
    new: true,
    runValidators: true,
  }).populate("categories", "name");

  if (!term) {
    throw new Error("Không tìm thấy thuật ngữ");
  }

  return { term };
};

exports.deleteTerm = async (termId) => {
  const term = await Term.findByIdAndDelete(termId);

  if (!term) {
    throw new Error("Không tìm thấy thuật ngữ");
  }

  return true;
};

exports.saveSearchHistory = async (userId, query, resultCount) => {
  await SearchHistory.create({
    user: userId,
    query,
    resultCount,
  });
};
