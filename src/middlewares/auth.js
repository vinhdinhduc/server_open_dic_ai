const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/response");

exports.authenticate = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return errorResponse(
        res,
        "Không có token, quyền truy cập bị từ chối",
        401,
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //Get info user from db
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return errorResponse(res, "Người dùng không tồn tại", 401);
    }

    if (user.status === "banned") {
      return errorResponse(res, "Tài khoản của bạn đã bị khóa", 403);
    }
    if (user.status === "inactive") {
      return errorResponse(res, "Tài khoản của bạn chưa được kích hoạt", 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return errorResponse(res, "Token không hợp lệ", 401);
    }
    if (error.name === "TokenExpiredError") {
      return errorResponse(res, "Token đã hết hạn", 401);
    }
  }
  return errorResponse(res, "Xác thực không thành công", 500);
};
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (user && user.status === "active") {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
