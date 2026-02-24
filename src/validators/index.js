const { body } = require("express-validator");

/**
 * Auth Validators
 */
const authValidators = {
  register: [
    body("fullName")
      .trim()
      .notEmpty()
      .withMessage("Họ tên là bắt buộc")
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ")
      .normalizeEmail(),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Mật khẩu là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ],

  login: [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ"),
    body("password").trim().notEmpty().withMessage("Mật khẩu là bắt buộc"),
  ],

  updateProfile: [
    body("fullName")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("preferredLanguage")
      .optional()
      .isIn(["vi", "lo", "en"])
      .withMessage("Ngôn ngữ không hợp lệ"),
  ],
  changePassword: [
    body("currentPassword")
      .optional({ nullable: true, checkFalsy: true })
      .trim(),
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("Mật khẩu mới là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu mới phải có ít nhất 6 ký tự"),
  ],

  googleLogin: [
    body("googleId").trim().notEmpty().withMessage("Google ID là bắt buộc"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ")
      .normalizeEmail(),
    body("fullName").trim().notEmpty().withMessage("Họ tên là bắt buộc"),
    body("avatar")
      .optional()
      .trim()
      .isURL()
      .withMessage("Avatar phải là URL hợp lệ"),
  ],
};

/**
 * Category Validators
 */
const categoryValidators = {
  create: [
    body("name.vi")
      .trim()
      .notEmpty()
      .withMessage("Tên danh mục tiếng Việt là bắt buộc"),
    body("slug")
      .trim()
      .notEmpty()
      .withMessage("Slug là bắt buộc")
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug chỉ được chứa chữ thường, số và dấu gạch ngang"),
    body("parentCategory")
      .optional()
      .isMongoId()
      .withMessage("ID danh mục cha không hợp lệ"),
    body("order")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Thứ tự phải là số nguyên dương"),
  ],

  update: [
    body("name.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Tên danh mục không được để trống"),
    body("slug")
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Slug chỉ được chứa chữ thường, số và dấu gạch ngang"),
  ],
};

/**
 * Comment Validators
 */
const commentValidators = {
  create: [
    body("term")
      .optional()
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body("termId")
      .optional()
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body().custom((value, { req }) => {
      if (!req.body.term && !req.body.termId) {
        throw new Error("ID thuật ngữ là bắt buộc (term hoặc termId)");
      }
      return true;
    }),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Nội dung bình luận là bắt buộc")
      .isLength({ min: 3, max: 500 })
      .withMessage("Bình luận phải từ 3-500 ký tự"),
    body("parentComment")
      .optional()
      .isMongoId()
      .withMessage("ID bình luận cha không hợp lệ"),
  ],

  update: [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Nội dung bình luận là bắt buộc")
      .isLength({ min: 3, max: 500 })
      .withMessage("Bình luận phải từ 3-500 ký tự"),
  ],

  moderate: [
    body("status")
      .isIn(["approved", "rejected"])
      .withMessage("Trạng thái không hợp lệ"),
  ],
};

/**
 * Contribution Validators
 */
const contributionValidators = {
  create: [
    body("type")
      .isIn(["new_term", "edit_term"])
      .withMessage("Loại đóng góp không hợp lệ"),
    body("term.vi")
      .optional({ checkFalsy: false })
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt là bắt buộc"),
    body("definition.vi")
      .optional({ checkFalsy: false })
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt là bắt buộc"),
    body("category")
      .notEmpty()
      .withMessage("Danh mục là bắt buộc")
      .isMongoId()
      .withMessage("ID danh mục không hợp lệ"),
    body("targetTerm")
      .if(body("type").equals("edit_term"))
      .notEmpty()
      .withMessage("Thuật ngữ gốc là bắt buộc khi chỉnh sửa")
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
  ],
  reject: [
    body("moderatorNote")
      .trim()
      .notEmpty()
      .withMessage("Lý do từ chối là bắt buộc"),
  ],
};

/**
 * Favorite Validators
 */
const favoriteValidators = {
  add: [
    body("term")
      .optional()
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body("termId")
      .optional()
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body().custom((value, { req }) => {
      if (!req.body.term && !req.body.termId) {
        throw new Error("ID thuật ngữ là bắt buộc (term hoặc termId)");
      }
      return true;
    }),
    body("note")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Ghi chú không được vượt quá 200 ký tự"),
  ],

  updateNote: [
    body("note")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Ghi chú không được vượt quá 200 ký tự"),
  ],
};

/**
 * Term Validators
 */
const termValidators = {
  create: [
    body("term.vi")
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt là bắt buộc"),
    body("definition.vi")
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt là bắt buộc"),
    body("category")
      .notEmpty()
      .withMessage("Danh mục là bắt buộc")
      .isMongoId()
      .withMessage("ID danh mục không hợp lệ"),
  ],

  update: [
    body("term.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Thuật ngữ tiếng Việt không được để trống"),
    body("definition.vi")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Định nghĩa tiếng Việt không được để trống"),
  ],
};

/**
 * User Validators
 */
const userValidators = {
  create: [
    body("fullName")
      .trim()
      .notEmpty()
      .withMessage("Họ tên là bắt buộc")
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email là bắt buộc")
      .isEmail()
      .withMessage("Email không hợp lệ")
      .normalizeEmail(),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Mật khẩu là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    body("role")
      .optional()
      .isIn(["user", "moderator", "admin"])
      .withMessage("Role không hợp lệ"),
    body("status")
      .optional()
      .isIn(["active", "inactive"])
      .withMessage("Status không hợp lệ"),
    body("preferredLanguage")
      .optional()
      .isIn(["vi", "en", "lo"])
      .withMessage("Ngôn ngữ không hợp lệ"),
  ],

  update: [
    body("fullName")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Họ tên không được vượt quá 50 ký tự"),
    body("role")
      .optional()
      .isIn(["user", "moderator", "admin"])
      .withMessage("Role không hợp lệ"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "banned"])
      .withMessage("Status không hợp lệ"),
  ],

  toggleStatus: [
    body("status")
      .isIn(["active", "inactive", "banned"])
      .withMessage("Status không hợp lệ"),
  ],

  resetPassword: [
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("Mật khẩu mới là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ],

  batchUpdateStatus: [
    body("userIds")
      .isArray({ min: 1 })
      .withMessage("Danh sách user ID không hợp lệ"),
    body("userIds.*").isMongoId().withMessage("User ID không hợp lệ"),
    body("status")
      .isIn(["active", "inactive", "banned"])
      .withMessage("Status không hợp lệ"),
  ],
};

/**
 * Report Validators
 */
const reportValidators = {
  create: [
    body("targetId")
      .notEmpty()
      .withMessage("ID thuật ngữ báo xấu là bắt buộc")
      .isMongoId()
      .withMessage("ID thuật ngữ không hợp lệ"),
    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Lý do báo xấu là bắt buộc")
      .isIn(["incorrect", "spam", "inappropriate", "duplicate", "other"])
      .withMessage("Lý do báo xấu không hợp lệ"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Mô tả không được vượt quá 1000 ký tự"),
  ],

  resolve: [
    body("status")
      .isIn(["resolved", "rejected"])
      .withMessage("Trạng thái xử lý không hợp lệ"),
    body("actionTaken")
      .optional()
      .isIn(["none", "warning", "edit", "delete", "ban_user"])
      .withMessage("Hành động không hợp lệ"),
    body("moderatorNote")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Ghi chú không được vượt quá 500 ký tự"),
  ],
};

module.exports = {
  authValidators,
  categoryValidators,
  commentValidators,
  contributionValidators,
  favoriteValidators,
  termValidators,
  userValidators,
  reportValidators,
};
