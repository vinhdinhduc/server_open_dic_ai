const { errorResponse } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Lỗi xác thực Mongoose
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    return errorResponse(res, "Lỗi xác thực dữ liệu", 400, errors);
  }

  // Lỗi trùng khóa của Mongoose
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(res, `${field} đã tồn tại`, 400);
  }

  // Lỗi ép kiểu Mongoose
  if (err.name === "CastError") {
    return errorResponse(res, "ID không hợp lệ", 400);
  }

  // Lỗi JWT
  if (err.name === "JsonWebTokenError") {
    return errorResponse(res, "Token không hợp lệ", 401);
  }

  if (err.name === "TokenExpiredError") {
    return errorResponse(res, "Token đã hết hạn", 401);
  }

  // Lỗi mặc định
  return errorResponse(
    res,
    err.message || "Lỗi máy chủ",
    err.statusCode || 500,
    err.errors || null,
  );
};

module.exports = errorHandler;
