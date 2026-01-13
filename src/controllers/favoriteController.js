const { successResponse, errorResponse } = require("../utils/response");
const Favorite = require("../models/Favorite");
const Term = require("../models/Term");

exports.toggleFavorite = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const userId = req.user._id;

    // Kiểm tra term có tồn tại không
    const term = await Term.findById(termId);
    if (!term) {
      return errorResponse(res, "Không tìm thấy thuật ngữ", 404);
    }

    // Kiểm tra đã favorite chưa
    const existingFavorite = await Favorite.findOne({
      user: userId,
      term: termId,
    });

    if (existingFavorite) {
      // Nếu đã favorite thì xóa
      await existingFavorite.deleteOne();
      await Term.findByIdAndUpdate(termId, { $inc: { favoriteCount: -1 } });
      return successResponse(res, "Đã bỏ yêu thích", { isFavorite: false });
    } else {
      // Nếu chưa thì thêm
      await Favorite.create({ user: userId, term: termId });
      await Term.findByIdAndUpdate(termId, { $inc: { favoriteCount: 1 } });
      return successResponse(res, "Đã thêm vào yêu thích", {
        isFavorite: true,
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.getFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const favorites = await Favorite.find({ user: userId })
      .populate("term")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Favorite.countDocuments({ user: userId });

    return successResponse(res, "Lấy danh sách yêu thích thành công", {
      favorites,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    next(error);
  }
};
