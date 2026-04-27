const rateLimit = require("express-rate-limit");
const MongoStore = require("rate-limit-mongo");
const SystemConfig = require("../models/SystemConfig");

let rateLimitConfig = {
  enabled: true,
  general: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
  api: {
    windowMs: 60 * 1000,
    max: 30,
  },
  login: {
    windowMs: 15 * 60 * 1000,
    max: 5,
  },
  register: {
    windowMs: 60 * 60 * 1000,
    max: 3,
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    max: 3,
  },
  contentCreation: {
    windowMs: 60 * 1000,
    max: 10,
  },
  ai: {
    windowMs: 60 * 1000,
    max: 5,
  },
};

/**
 * Load rate limit config từ database
 */
async function loadRateLimitConfig() {
  try {
    const configs = await SystemConfig.find({
      category: "security",
      isActive: true,
    });

    if (configs && configs.length > 0) {
      configs.forEach((config) => {
        const { key, value } = config;

        if (key === "rate_limit_enabled") {
          rateLimitConfig.enabled = value;
        } else if (key === "rate_limit_window_ms") {
          rateLimitConfig.general.windowMs = value;
        } else if (key === "rate_limit_max_requests") {
          rateLimitConfig.general.max = value;
        } else if (key === "rate_limit_api_window_ms") {
          rateLimitConfig.api.windowMs = value;
        } else if (key === "rate_limit_api_max_requests") {
          rateLimitConfig.api.max = value;
        } else if (key === "rate_limit_login_window_ms") {
          rateLimitConfig.login.windowMs = value;
        } else if (key === "rate_limit_login_max_attempts") {
          rateLimitConfig.login.max = value;
        } else if (key === "rate_limit_ai_window_ms") {
          rateLimitConfig.ai.windowMs = value;
        } else if (key === "rate_limit_ai_max_requests") {
          rateLimitConfig.ai.max = value;
        }
      });
    } else {
      console.log("[Rate Limit]  No config found in DB, using defaults");
    }
  } catch (error) {
    console.error("[Rate Limit]  Error loading config:", error.message);
    console.log("[Rate Limit] Using default config");
  }
}

// Load config khi khởi động
loadRateLimitConfig();

/**
 * Middleware to skip rate limiting if disabled in config
 */
const skipIfDisabled = (req, res) => {
  return !rateLimitConfig.enabled;
};

const getCurrentConfig = () => rateLimitConfig;

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Quá nhiều requests từ IP này, vui lòng thử lại sau",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "rateLimits",
        expireTimeMs: 15 * 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter cho API endpoints
 * Sử dụng config động từ database
 */
const apiLimiter = rateLimit({
  windowMs: () => rateLimitConfig.api.windowMs,
  max: () => rateLimitConfig.api.max,
  message: {
    error: "Quá nhiều requests đến API này, vui lòng thử lại sau",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "apiRateLimits",
        expireTimeMs: 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter nghiêm ngặt cho login để chống brute force
 * Sử dụng config động từ database
 */
const loginLimiter = rateLimit({
  windowMs: () => rateLimitConfig.login.windowMs,
  max: () => rateLimitConfig.login.max,
  message: {
    error: `Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau ${rateLimitConfig.login.windowMs / 60000} phút`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Không đếm các request thành công
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "loginRateLimits",
        expireTimeMs: 15 * 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter cho đăng ký tài khoản
 */
const registerLimiter = rateLimit({
  windowMs: () => rateLimitConfig.register.windowMs,
  max: () => rateLimitConfig.register.max,
  message: {
    error: "Quá nhiều tài khoản được tạo từ IP này, vui lòng thử lại sau",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "registerRateLimits",
        expireTimeMs: 60 * 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter cho password reset
 */
const passwordResetLimiter = rateLimit({
  windowMs: () => rateLimitConfig.passwordReset.windowMs,
  max: () => rateLimitConfig.passwordReset.max,
  message: {
    error: "Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "passwordResetLimits",
        expireTimeMs: 60 * 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter cho việc gửi comment/contribution
 */
const contentCreationLimiter = rateLimit({
  windowMs: () => rateLimitConfig.contentCreation.windowMs,
  max: () => rateLimitConfig.contentCreation.max,
  message: {
    error: "Bạn đang tạo nội dung quá nhanh, vui lòng chậm lại",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "contentCreationLimits",
        expireTimeMs: 60 * 1000,
      })
    : undefined,
});

/**
 * Rate limiter cho AI requests (tốn kém)
 */
const aiLimiter = rateLimit({
  windowMs: () => rateLimitConfig.ai.windowMs,
  max: () => rateLimitConfig.ai.max,
  message: {
    error: "Quá nhiều yêu cầu AI, vui lòng thử lại sau",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  store: process.env.MONGODB_URI
    ? new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: "aiRateLimits",
        expireTimeMs: 60 * 1000,
      })
    : undefined,
});

module.exports = {
  generalLimiter,
  apiLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  contentCreationLimiter,
  aiLimiter,
  // Xuất các hàm hỗ trợ
  loadRateLimitConfig,
  getCurrentConfig,
};
