const { errorResponse } = require("../utils/response");
const { USER_ROLES } = require("../utils/constants");

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
