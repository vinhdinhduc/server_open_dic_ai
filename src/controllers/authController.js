const { successResponse, errorResponse } = require("../utils/response");
const authService = require("../services/authService");

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const result = await authService.register(username, email, password);
    return successResponse(res, "Đăng ký thành công", result, 201);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return successResponse(res, "Đăng nhập thành công", result);
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    return successResponse(res, "Lấy thông tin thành công", { user: req.user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    const result = await authService.updateProfile(userId, updates);
    return successResponse(res, "Cập nhật thông tin thành công", result);
  } catch (error) {
    next(error);
  }
};
