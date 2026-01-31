const express = require("express");
const favoriteController = require("../controllers/favoriteController");
const { authenticate } = require("../middlewares/auth");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");
const { favoriteValidators } = require("../validators");

const favoriteRouter = express.Router();

/**
 * @route   POST /api/favorites
 * @desc    Thêm vào yêu thích
 * @access  Private
 */
favoriteRouter.post(
  "/",
  authenticate,
  favoriteValidators.add,
  validate,
  favoriteController.addFavorite,
);

/**
 * @route   DELETE /api/favorites/:termId
 * @desc    Xóa khỏi yêu thích
 * @access  Private
 */
favoriteRouter.delete(
  "/:termId",
  authenticate,
  validateObjectId("termId"),
  favoriteController.removeFavorite,
);

/**
 * @route   GET /api/favorites
 * @desc    Lấy danh sách yêu thích
 * @access  Private
 */
favoriteRouter.get(
  "/",
  authenticate,
  validatePagination,
  favoriteController.getFavorites,
);

/**
 * @route   GET /api/favorites/check/:termId
 * @desc    Kiểm tra đã yêu thích chưa
 * @access  Private
 */
favoriteRouter.get(
  "/check/:termId",
  authenticate,
  validateObjectId("termId"),
  favoriteController.checkFavorite,
);

/**
 * @route   POST /api/favorites/toggle
 * @desc    Toggle yêu thích (thêm nếu chưa có, xóa nếu đã có)
 * @access  Private
 */
favoriteRouter.post(
  "/toggle",
  authenticate,
  favoriteValidators.add,
  validate,
  favoriteController.toggleFavorite,
);

/**
 * @route   PUT /api/favorites/:termId/note
 * @desc    Cập nhật ghi chú
 * @access  Private
 */
favoriteRouter.put(
  "/:termId/note",
  authenticate,
  validateObjectId("termId"),
  favoriteValidators.updateNote,
  validate,
  favoriteController.updateNote,
);

module.exports = favoriteRouter;
