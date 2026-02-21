const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");
const validator = require("validator");
const hpp = require("hpp");

/**
 * Cấu hình Helmet với các HTTP security headers
 */
const helmetConfig = helmet({
  // Content Security Policy - Chống XSS
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Cho phép inline styles nếu cần
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false,
  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // Expect-CT (deprecated nhưng vẫn hữu ích)
  expectCt: { maxAge: 86400 },
  // X-Frame-Options - Chống Clickjacking
  frameguard: { action: "deny" },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 năm
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open
  ieNoOpen: true,
  // X-Content-Type-Options
  noSniff: true,
  // Origin-Agent-Cluster
  originAgentCluster: true,
  // Permissions Policy (thay thế Feature Policy)
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  // Referrer Policy
  referrerPolicy: { policy: "no-referrer" },
  // X-XSS-Protection
  xssFilter: true,
});

/**
 * Middleware chống NoSQL Injection
 * Loại bỏ các ký tự đặc biệt MongoDB như $, .
 */
const noSqlInjectionProtection = (req, res, next) => {
  // Sanitize là xóa bỏ các ký tự nguy hiểm, không modify req.query trực tiếp
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      // Loại bỏ các operators MongoDB nguy hiểm
      return value.replace(/[${}]/g, "");
    }
    if (typeof value === "object" && value !== null) {
      // Nếu là object thì check từng key
      const clean = {};
      for (const key in value) {
        // Bỏ qua keys bắt đầu bằng $
        if (!key.startsWith("$") && !key.includes(".")) {
          clean[key] = sanitizeValue(value[key]);
        } else {
          console.warn(
            `[Security] NoSQL Injection attempt - dangerous key: ${key}`,
          );
          console.warn(`From IP: ${req.ip} - Path: ${req.path}`);
        }
      }
      return clean;
    }
    return value;
  };

  // Sanitize body, params (không touch query vì nó read-only)
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params);
  }

  next();
};

/**
 * Middleware chống XSS (Cross-Site Scripting)
 * Sanitize user input từ request body, query params, và url params
 */
const xssProtection = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      // Sử dụng thư viện xss để sanitize
      return xss(value, {
        whiteList: {}, // Không cho phép bất kỳ HTML tags nào
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style"],
      });
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
    }
    if (typeof value === "object" && value !== null) {
      const clean = {};
      for (const key in value) {
        clean[key] = sanitizeValue(value[key]);
      }
      return clean;
    }
    return value;
  };

  // Sanitize body và params (không touch query)
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params);
  }

  next();
};

/**
 * Middleware chống HTTP Parameter Pollution
 * Ngăn chặn tấn công bằng cách gửi nhiều params trùng tên
 */
const parameterPollutionProtection = hpp({
  whitelist: [
    // Cho phép các params này có nhiều giá trị
    "sort",
    "filter",
    "category",
    "tags",
    "status",
  ],
});

/**
 * Middleware bổ sung các security headers tùy chỉnh
 */
const customSecurityHeaders = (req, res, next) => {
  // Ngăn chặn trình duyệt cache các response chứa dữ liệu nhạy cảm
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Server information hiding
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // Additional CORS security
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  next();
};

/**
 * Middleware log các request nguy hiểm
 */
const securityLogger = (req, res, next) => {
  // Log các patterns nguy hiểm
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\$where/i,
    /\$ne/i,
    /\.\./i, // Path traversal (Unix: ..)
    /etc\/passwd/i,
    /\.\.\\/, // Windows path traversal (..\)
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  suspiciousPatterns.forEach((pattern) => {
    if (pattern.test(requestData)) {
      console.warn(`[Security Alert] Suspicious pattern detected: ${pattern}`);
      console.warn(`From IP: ${req.ip}`);
      console.warn(`Method: ${req.method} ${req.path}`);
      console.warn(`Data: ${requestData}`);
    }
  });

  next();
};

/**
 * Middleware validate và sanitize input
 */
const inputSanitization = (req, res, next) => {
  // Trim whitespace từ tất cả string inputs
  const sanitizeObject = (obj) => {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].trim();
        } else if (typeof obj[key] === "object") {
          sanitizeObject(obj[key]);
        }
      });
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

module.exports = {
  helmetConfig,
  noSqlInjectionProtection,
  xssProtection,
  parameterPollutionProtection,
  customSecurityHeaders,
  securityLogger,
  inputSanitization,
};
