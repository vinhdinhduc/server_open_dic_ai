const { errorResponse } = require("../utils/response");
const { USER_ROLES, MODERATION_PERMISSIONS } = require("../utils/constants");

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        "Bạn không có quyền truy cập tài nguyên này",
        403,
      );
    }
    next();
  };
};
exports.isAdmin = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "Vui lòng đăng nhập để tiếp tục", 401);
  }

  if (req.user.role !== USER_ROLES.ADMIN) {
    return errorResponse(
      res,
      "Chỉ quản trị viên mới có quyền truy cập tài nguyên này",
      403,
    );
  }
  next();
};

exports.isModerator = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "Vui lòng đăng nhập để tiếp tục", 401);
  }

  if (![USER_ROLES.ADMIN, USER_ROLES.MODERATOR].includes(req.user.role)) {
    return errorResponse(
      res,
      "Chỉ quản trị viên hoặc người kiểm duyệt mới có quyền truy cập tài nguyên này",
      403,
    );
  }
  next();
};

/**
 * Middleware kiểm tra quyền moderator theo danh mục
 * Moderator chỉ được phép thao tác với nội dung thuộc danh mục được admin gán
 * @param {string} permissionType - Loại quyền cần kiểm tra (terms, contributions, comments, reports)
 */
exports.checkModeratorPermission = (permissionType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }

    // Admin có toàn quyền
    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    // Kiểm tra role là moderator
    if (req.user.role !== USER_ROLES.MODERATOR) {
      return errorResponse(
        res,
        "Chỉ quản trị viên hoặc người kiểm duyệt mới có quyền truy cập",
        403,
      );
    }

    const { moderationPermissions } = req.user;

    // Kiểm tra moderator có quyền cho loại nội dung này không
    if (
      !moderationPermissions?.permissions ||
      !moderationPermissions.permissions.includes(permissionType)
    ) {
      return errorResponse(
        res,
        `Bạn không có quyền kiểm duyệt ${permissionType}`,
        403,
      );
    }

    // Lưu danh sách category được phép vào request để sử dụng trong controller/service
    req.allowedCategories = moderationPermissions.categories || [];

    next();
  };
};

/**
 * Middleware kiểm tra category của resource có nằm trong quyền của moderator không
 * Sử dụng sau checkModeratorPermission
 * @param {Function} getCategoryFromResource - Hàm lấy categoryId từ resource
 */
exports.checkCategoryAccess = (getCategoryFromResource) => {
  return async (req, res, next) => {
    // Admin có toàn quyền
    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    try {
      const categoryId = await getCategoryFromResource(req);

      if (!categoryId) {
        return errorResponse(res, "Không tìm thấy danh mục của nội dung", 404);
      }

      // Kiểm tra category có trong danh sách được phép không
      const categoryIdStr = categoryId.toString();
      const isAllowed = req.allowedCategories.some(
        (cat) => cat.toString() === categoryIdStr,
      );

      if (!isAllowed) {
        return errorResponse(
          res,
          "Bạn không có quyền kiểm duyệt nội dung trong danh mục này",
          403,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check quyền sở huữu tài nguyên
exports.isOwner = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Vui lòng đăng nhập để tiếp tục", 401);
    }

    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }
    // Check sở hữu

    const resourceUserId =
      req.resource?.[resourceUserIdField || req.params[resourceUserIdField]];

    if (!resourceUserId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, "Không tìm thấy tài nguyên", 404);
    }
    return next();
  };
};
