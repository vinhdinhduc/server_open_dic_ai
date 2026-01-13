const { errorResponse } = require("../utils/response");

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Không có quyền truy cập", 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Người dùng với vai trò '${req.user.role}' không có quyền truy cập`,
        403
      );
    }

    next();
  };
};
