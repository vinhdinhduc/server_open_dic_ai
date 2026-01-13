const { errorResponse } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    return errorResponse(res, "Lỗi xác thực dữ liệu", 400, errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(res, `${field} đã tồn tại`, 400);
  }

  // Mongoose cast error
  if (err.name === "CastError") {
    return errorResponse(res, "ID không hợp lệ", 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return errorResponse(res, "Token không hợp lệ", 401);
  }

  if (err.name === "TokenExpiredError") {
    return errorResponse(res, "Token đã hết hạn", 401);
  }

  // Default error
  return errorResponse(
    res,
    err.message || "Lỗi máy chủ",
    err.statusCode || 500
  );
};

module.exports = errorHandler;
