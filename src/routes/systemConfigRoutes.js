const express = require("express");
const router = express.Router();
const systemConfigController = require("../controllers/systemConfigController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");

router.use(authenticate, isAdmin);

/**
 * @route   GET /api/system-config/rate-limit/status
 * @desc    Get current rate limit config and status
 * @access  Private - Admin
 */
router.get("/rate-limit/status", systemConfigController.getRateLimitStatus);

/**
 * @route   POST /api/system-config/rate-limit/reload
 * @desc    Reload rate limit config from database
 * @access  Private - Admin
 */
router.post("/rate-limit/reload", systemConfigController.reloadRateLimitConfig);

/**
 * @route   GET /api/system-config
 * @desc    Get system configs (with optional category filter)
 * @access  Private - Admin
 */
router.get("/", systemConfigController.getConfigsByCategory);

/**
 * @route   GET /api/system-config/:key
 * @desc    Get a single config by key
 * @access  Private - Admin
 */
router.get("/:key", systemConfigController.getConfigByKey);

/**
 * @route   PUT /api/system-config/bulk
 * @desc    Update multiple configs at once
 * @access  Private - Admin
 */
router.put("/bulk", systemConfigController.updateConfigsBulk);

/**
 * @route   PUT /api/system-config/:key
 * @desc    Update a config by key
 * @access  Private - Admin
 */
router.put("/:key", systemConfigController.updateConfigByKey);

/**
 * @route   POST /api/system-config
 * @desc    Create a new config
 * @access  Private - Admin
 */
router.post("/", systemConfigController.createConfig);

/**
 * @route   DELETE /api/system-config/:key
 * @desc    Delete (soft delete) a config
 * @access  Private - Admin
 */
router.delete("/:key", systemConfigController.deleteConfig);

module.exports = router;
