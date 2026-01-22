const express = require("express");
const { body } = require("express-validator");
const favoriteController = require("../controllers/favoriteController");
const { authenticate } = require("../middlewares/auth");
const {
  validate,
  validatePagination,
  validateObjectId,
} = require("../middlewares/validate");

const favoriteRouter = express.Router();

/**
 * @route   POST /api/favorites
 * @desc    Thêm vào yêu thích
 * @access  Private
 */
favoriteRouter.post(
  "/",
  authenticate,
  [
    body("termId")
      .notEmpty()
      .withMessage("ID thuật ngữ là bắt buộc")
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body("note")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Ghi chú không được vượt quá 200 ký tự"),
    validate,
  ],
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
 * @route   PUT /api/favorites/:termId/note
 * @desc    Cập nhật ghi chú
 * @access  Private
 */
favoriteRouter.put(
  "/:termId/note",
  authenticate,
  validateObjectId("termId"),
  [
    body("note")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Ghi chú không được vượt quá 200 ký tự"),
    validate,
  ],
  favoriteController.updateNote,
);

module.exports = favoriteRouter;
