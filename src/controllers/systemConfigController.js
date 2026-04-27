const { successResponse } = require("../utils/response");
const SystemConfig = require("../models/SystemConfig");
const { maskSensitiveData, shouldEncrypt } = require("../utils/encryption");
const {
  loadRateLimitConfig,
  getCurrentConfig,
} = require("../middlewares/rateLimiter");

const maskConfigValue = (config) => {
  const configObj = config.toObject ? config.toObject() : config;

  if (shouldEncrypt(configObj.key) && typeof configObj.value === "string") {
    return {
      ...configObj,
      value: maskSensitiveData(configObj.value),
      _originalValueMasked: true,
    };
  }

  return configObj;
};

/**
 * @route   GET /api/system-config
 * @desc    Get system configs by category
 * @access  Private - Admin
 */
exports.getConfigsByCategory = async (req, res, next) => {
  try {
    const { category, includeSensitive } = req.query;

    const query = { isActive: true };
    if (category) {
      query.category = category;
    }

    const configs = await SystemConfig.find(query).select(
      "key value description category isEncrypted",
    );

    const processedConfigs =
      includeSensitive === "true" ? configs : configs.map(maskConfigValue);

    return successResponse(res, "Lấy cấu hình thành công", processedConfigs);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/system-config/:key
 * @desc    Get a single config by key
 * @access  Private - Admin
 */
exports.getConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { includeSensitive } = req.query;

    const config = await SystemConfig.findOne({ key, isActive: true });

    if (!config) {
      const error = new Error("Không tìm thấy cấu hình");
      error.statusCode = 404;
      throw error;
    }

    const processedConfig =
      includeSensitive === "true" ? config : maskConfigValue(config);

    return successResponse(res, "Lấy cấu hình thành công", processedConfig);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/system-config/:key
 * @desc    Update a config by key
 * @access  Private - Admin
 */
exports.updateConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      {
        value,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      },
      { new: true, upsert: true },
    );

    const processedConfig = maskConfigValue(config);

    return successResponse(
      res,
      "Cập nhật cấu hình thành công",
      processedConfig,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/system-config/bulk
 * @desc    Update multiple configs at once
 * @access  Private - Admin
 */
exports.updateConfigsBulk = async (req, res, next) => {
  try {
    const { configs, category } = req.body;

    if (!configs || typeof configs !== "object") {
      const error = new Error("Dữ liệu cấu hình không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const results = [];
    for (const [key, value] of Object.entries(configs)) {
      const updateData = {
        value,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      };

      if (category) {
        updateData.category = category;
      }

      const config = await SystemConfig.findOneAndUpdate({ key }, updateData, {
        new: true,
        upsert: true,
      });

      results.push(maskConfigValue(config));
    }

    if (category === "security") {
      await loadRateLimitConfig();
    }

    return successResponse(res, "Cập nhật cấu hình thành công", results);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/system-config
 * @desc    Create a new config
 * @access  Private - Admin
 */
exports.createConfig = async (req, res, next) => {
  try {
    const { key, value, description, category } = req.body;

    const existingConfig = await SystemConfig.findOne({ key });
    if (existingConfig) {
      const error = new Error("Cấu hình đã tồn tại");
      error.statusCode = 400;
      throw error;
    }

    const config = await SystemConfig.create({
      key,
      value,
      description,
      category: category || "general",
      updatedBy: req.user._id,
    });

    return successResponse(res, "Tạo cấu hình thành công", config, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/system-config/:key
 * @desc    Delete (soft delete) a config
 * @access  Private - Admin
 */
exports.deleteConfig = async (req, res, next) => {
  try {
    const { key } = req.params;

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      { isActive: false, updatedBy: req.user._id },
      { new: true },
    );

    if (!config) {
      const error = new Error("Không tìm thấy cấu hình");
      error.statusCode = 404;
      throw error;
    }

    return successResponse(res, "Xóa cấu hình thành công");
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/system-config/rate-limit/status
 * @desc    Get current rate limit config and status
 * @access  Private - Admin
 */
exports.getRateLimitStatus = async (req, res, next) => {
  try {
    const currentConfig = getCurrentConfig();

    return successResponse(
      res,
      "Lấy trạng thái rate limit thành công",
      currentConfig,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/system-config/rate-limit/reload
 * @desc    Reload rate limit config from database
 * @access  Private - Admin
 */
exports.reloadRateLimitConfig = async (req, res, next) => {
  try {
    await loadRateLimitConfig();

    const currentConfig = getCurrentConfig();

    return successResponse(
      res,
      "Đã reload cấu hình rate limit thành công",
      currentConfig,
    );
  } catch (error) {
    next(error);
  }
};
