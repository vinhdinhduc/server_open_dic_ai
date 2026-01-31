const Favorite = require("../models/Favorite");
const Term = require("../models/Term");

//Add favorite
exports.addFavorite = async (userId, termId, note = "") => {
  //Check thuật ngữ có tồn tại không

  const term = await Term.findById(termId);
  if (!term) {
    const error = new Error("Thuật ngữ không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  //Check đã favorite chưa
  const existingFavorite = await Favorite.findOne({
    user: userId,
    term: termId,
  });
  if (existingFavorite) {
    const error = new Error("Thuật ngữ đã được thêm vào yêu thích");
    error.statusCode = 400;
    throw error;
  }

  const favorite = await Favorite.create({
    user: userId,
    term: termId,
    note: note || "",
  });

  //Tăng favorite count cho term
  term.favoriteCount = (term.favoriteCount || 0) + 1;
  await term.save();

  await favorite.populate("term", "term description category");
  return favorite;
};
//Remove favorite

exports.removeFavorite = async (userId, termId) => {
  const favorite = await Favorite.findOne({
    user: userId,
    term: termId,
  });
  if (!favorite) {
    const error = new Error("Thuật ngữ chưa được thêm vào yêu thích");
    error.statusCode = 400;
    throw error;
  }
  await favorite.deleteOne();

  // Giảm favorite count cho term
  await Term.findByIdAndUpdate(termId, {
    $inc: { favoriteCount: -1 },
  });
  return {
    message: "Đã xoá khỏi danh sách yêu thích",
  };
};

// Lấ sách thuật ngữ yêu thích của user
exports.getFavorites = async (userId, options = {}) => {
  const { page = 1, limit = 10, category } = options;
  const skip = (page - 1) * limit;
  const query = { user: userId };
  const [favorites, total] = await Promise.all([
    Favorite.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "term",
        select: "term definition category viewCount favoriteCount ",
        populate: { path: "category", select: "name icon" },
        match: category ? { category } : {},
      }),
    Favorite.countDocuments(query),
  ]);

  // Loại bỏ những favorite có term bị xoá

  const filteredFavorites = favorites.filter((fav) => fav.term !== null);
  return {
    favorites: filteredFavorites,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

//Check term favorite yet or not
exports.checkFavorite = async (userId, termId) => {
  const favorite = await Favorite.findOne({ user: userId, term: termId });
  return { isFavorited: !!favorite };
};

// Toggle favorite - thêm nếu chưa có, xóa nếu đã có
exports.toggleFavorite = async (userId, termId) => {
  const term = await Term.findById(termId);
  if (!term) {
    const error = new Error("Thuật ngữ không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  const existingFavorite = await Favorite.findOne({
    user: userId,
    term: termId,
  });

  if (existingFavorite) {
    // Đã favorite -> xóa
    await existingFavorite.deleteOne();
    term.favoriteCount = Math.max(0, (term.favoriteCount || 0) - 1);
    await term.save();
    return { isFavorited: false };
  } else {
    // Chưa favorite -> thêm
    await Favorite.create({
      user: userId,
      term: termId,
    });
    term.favoriteCount = (term.favoriteCount || 0) + 1;
    await term.save();
    return { isFavorited: true };
  }
};

/**
 * Cập nhật ghi chú
 */
exports.updateNote = async (userId, termId, note) => {
  const favorite = await Favorite.findOne({ user: userId, term: termId });

  if (!favorite) {
    const error = new Error("Không tìm thấy trong danh sách yêu thích");
    error.statusCode = 404;
    throw error;
  }

  favorite.note = note;
  await favorite.save();

  return favorite;
};
