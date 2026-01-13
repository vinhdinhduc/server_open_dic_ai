const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const contributionController = require("../controllers/contributionController");
const { protect } = require("../middlewares/auth");
const { authorize } = require("../middlewares/authorize");
const { validate } = require("../middlewares/validate");

// Tạo đóng góp mới
router.post(
  "/",
  protect,
  [
    body("type")
      .isIn(["new_term", "edit_term", "report_error"])
      .withMessage("Loại đóng góp không hợp lệ"),
    body("data").notEmpty().withMessage("Vui lòng nhập dữ liệu đóng góp"),
    validate,
  ],
  contributionController.createContribution
);

// Lấy danh sách đóng góp
router.get("/", protect, contributionController.getContributions);

// Đánh giá đóng góp (chỉ admin/moderator)
router.put(
  "/:id/review",
  protect,
  authorize("admin", "moderator"),
  [
    body("status")
      .isIn(["approved", "rejected"])
      .withMessage("Trạng thái không hợp lệ"),
    validate,
  ],
  contributionController.reviewContribution
);

module.exports = router;
