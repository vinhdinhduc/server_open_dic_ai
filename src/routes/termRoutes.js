const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const termController = require("../controllers/termController");
const { protect } = require("../middlewares/auth");
const { authorize } = require("../middlewares/authorize");
const { validate } = require("../middlewares/validate");

// Tìm kiếm thuật ngữ (public)
router.get("/search", termController.searchTerms);

// Lấy chi tiết thuật ngữ (public)
router.get("/:id", termController.getTerm);

// Tạo thuật ngữ mới (yêu cầu authentication)
router.post(
  "/",
  protect,
  [
    body("term").trim().notEmpty().withMessage("Vui lòng nhập thuật ngữ"),
    body("definition")
      .trim()
      .notEmpty()
      .withMessage("Vui lòng nhập định nghĩa"),
    validate,
  ],
  termController.createTerm
);

// Cập nhật thuật ngữ (chỉ admin/moderator)
router.put(
  "/:id",
  protect,
  authorize("admin", "moderator"),
  termController.updateTerm
);

// Xóa thuật ngữ (chỉ admin)
router.delete("/:id", protect, authorize("admin"), termController.deleteTerm);

module.exports = router;
