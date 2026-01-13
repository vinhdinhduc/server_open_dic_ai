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
