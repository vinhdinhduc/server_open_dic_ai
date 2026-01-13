const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/response");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return errorResponse(res, "Không có quyền truy cập", 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Lấy thông tin user
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return errorResponse(res, "Người dùng không tồn tại", 401);
    }

    if (!req.user.isActive) {
      return errorResponse(res, "Tài khoản đã bị vô hiệu hóa", 401);
    }

    next();
  } catch (error) {
    return errorResponse(res, "Token không hợp lệ", 401);
  }
};
