const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const commentController = require("../controllers/commentController");
const { protect } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");

// Tạo bình luận
router.post(
  "/",
  protect,
  [
    body("termId").notEmpty().withMessage("Vui lòng chọn thuật ngữ"),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Vui lòng nhập nội dung bình luận"),
    validate,
  ],
  commentController.createComment
);

// Lấy bình luận của một thuật ngữ
router.get("/term/:termId", commentController.getComments);

// Cập nhật bình luận
router.put(
  "/:id",
  protect,
  [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Vui lòng nhập nội dung bình luận"),
    validate,
  ],
  commentController.updateComment
);

// Xóa bình luận
router.delete("/:id", protect, commentController.deleteComment);

module.exports = router;
