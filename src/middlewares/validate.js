const { validationResult } = require("express-validator");
const { errorResponse } = require("../utils/response");

exports.validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return errorResponse(res, "Dữ liệu không hợp lệ", 400, errorMessages);
  }

  next();
};

exports.validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (limit > 100) {
    return errorResponse(
      res,
      "Giới hạn mỗi trang không được vượt quá 100",
      400,
    );
  }

  req.pagination = { page, limit, skip };
  next();
};
exports.validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const mongoose = require("mongoose");
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, `${paramName} không hợp lệ`, 400);
    }
    next();
  };
};
