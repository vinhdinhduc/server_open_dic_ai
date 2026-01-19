const { successResponse } = require("../utils/response");
const favoriteService = require("../services/favoriteService");

/**
 * @route   POST /api/favorites
 * @desc    Thêm thuật ngữ vào yêu thích
 * @access  Private
 */
exports.addFavorite = async (req, res, next) => {
  try {
    const { termId, note } = req.body;
    const userId = req.user._id;

    const favorite = await favoriteService.addFavorite(userId, termId, note);

    return successResponse(
      res,
      "Đã thêm vào danh sách yêu thích",
      favorite,
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/favorites/:termId
 * @desc    Xóa khỏi yêu thích
 * @access  Private
 */
exports.removeFavorite = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const userId = req.user._id;

    const result = await favoriteService.removeFavorite(userId, termId);

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/favorites
 * @desc    Lấy danh sách yêu thích
 * @access  Private
 */
exports.getFavorites = async (req, res, next) => {
  try {
    const { category } = req.query;
    const { page, limit } = req.pagination;
    const userId = req.user._id;

    const result = await favoriteService.getFavorites(userId, {
      page,
      limit,
      category,
    });

    return successResponse(res, "Lấy danh sách thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/favorites/check/:termId
 * @desc    Kiểm tra thuật ngữ đã được yêu thích chưa
 * @access  Private
 */
exports.checkFavorite = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const userId = req.user._id;

    const result = await favoriteService.checkFavorite(userId, termId);

    return successResponse(res, "Kiểm tra thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/favorites/:termId/note
 * @desc    Cập nhật ghi chú
 * @access  Private
 */
exports.updateNote = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const { note } = req.body;
    const userId = req.user._id;

    const favorite = await favoriteService.updateNote(userId, termId, note);

    return successResponse(res, "Cập nhật ghi chú thành công", favorite);
  } catch (error) {
    next(error);
  }
};
