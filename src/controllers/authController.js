const { successResponse } = require("../utils/response");
const authService = require("../services/authService");

//đăng kí

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const user = await authService.register({ fullName, email, password });
    successResponse(res, "Đăng ký thành công", user, 201);
  } catch (error) {
    next(error);
  }
};
/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return successResponse(res, "Đăng nhập thành công", result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/profile
 * @desc    Lấy thông tin profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile = await authService.getProfile(userId);

    return successResponse(res, "Lấy thông tin thành công", profile);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Cập nhật profile
 * @access  Private
 */
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

/**
 * @route   PUT /api/auth/change-password
 * @desc    Đổi mật khẩu
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );

    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất (client xóa token)
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // Backend không cần làm gì, client sẽ xóa token
    return successResponse(res, "Đăng xuất thành công");
  } catch (error) {
    next(error);
  }
};
