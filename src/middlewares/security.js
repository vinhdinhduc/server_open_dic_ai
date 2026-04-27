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
      // Không thay đổi string để tránh làm hỏng placeholder như {{userName}}.
      return value;
    }
    // Xử lý mảng trước khi xử lý object (vì Array cũng là typeof "object")
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
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
 * Whitelist các HTML tags an toàn được sinh ra bởi Quill RichTextEditor.
 * Chỉ cho phép các tags định dạng nội bộ, không có event handlers.
 */
const RICH_TEXT_XSS_WHITELIST = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  ul: ["class"],
  ol: ["class"],
  li: ["class", "data-list"],
  blockquote: [],
  pre: ["class"],
  code: ["class"],
  span: ["class"],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
};

/**
 * Các field chứa rich-text HTML (Quill editor) – cần whitelist an toàn.
 * Tất cả fields khác bị strip hoàn toàn.
 */
const RICH_TEXT_FIELDS = new Set([
  "definition",
  "detailedExplanation",
  "vi",
  "en",
  "lo",
]);

const EMAIL_TEMPLATE_HTML_FIELDS = new Set([
  "email_template_shell_footer_note",
  "email_template_shell_footer_copyright",
]);

const EMAIL_TEMPLATE_CONTENT_FIELDS = new Set(["intro", "warningHtml"]);

const EMAIL_TEMPLATE_BODY_KEY_REGEX = /^email_template_[a-zA-Z0-9_]+_body$/;

const EMAIL_TEMPLATE_XSS_WHITELIST = {
  p: ["style"],
  br: [],
  strong: ["style"],
  b: ["style"],
  em: ["style"],
  i: ["style"],
  u: ["style"],
  span: ["style"],
  div: ["style"],
  ul: ["style"],
  ol: ["style"],
  li: ["style"],
  a: ["href", "target", "rel", "style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  table: ["style", "cellpadding", "cellspacing", "width"],
  tbody: [],
  thead: [],
  tr: ["style"],
  td: ["style", "align", "valign", "colspan", "rowspan", "width"],
  th: ["style", "align", "valign", "colspan", "rowspan", "width"],
};

const isEmailTemplateHtmlField = (fieldName = "") =>
  EMAIL_TEMPLATE_HTML_FIELDS.has(fieldName) ||
  EMAIL_TEMPLATE_BODY_KEY_REGEX.test(fieldName);

/**
 * Middleware chống XSS (Cross-Site Scripting)
 * - Rich-text fields (definition, detailedExplanation và các subkey ngôn ngữ)
 *   được ghép với whitelist tags an toàn của Quill.
 * - Tất cả các fields khác bị strip sạch HTML.
 */
const xssProtection = (req, res, next) => {
  const isEmailTemplateAdminRequest =
    req.originalUrl?.includes("/api/users/email-templates/") ||
    req.path?.includes("/api/users/email-templates/");

  /**
   * Sanitize một giá trị string theo chế độ được chỉ định.
   * @param {string} value - chuỗi cần xử lý
   * @param {"plain" | "richText" | "emailTemplateHtml"} mode - chế độ sanitize
   */
  const sanitizeString = (value, mode = "plain") => {
    if (mode === "richText") {
      return xss(value, {
        whiteList: RICH_TEXT_XSS_WHITELIST,
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style"],
        onTagAttr: (tag, name, value) => {
          // Chặn mọi event handler attribute (onclick, onload, …)
          if (/^on\w+/i.test(name)) return "";
          // Chặn javascript: trong href/src
          if ((name === "href" || name === "src") && /javascript:/i.test(value))
            return "";
          return undefined; // cho phép attribute bình thường
        },
      });
    }

    if (mode === "emailTemplateHtml") {
      return xss(value, {
        whiteList: EMAIL_TEMPLATE_XSS_WHITELIST,
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style"],
        css: false,
        onTagAttr: (tag, name, value) => {
          // Chặn mọi event handler attribute (onclick, onload, ...)
          if (/^on\w+/i.test(name)) return "";

          if (name === "href" || name === "src") {
            const isVariable = /^{{\s*[a-zA-Z0-9_]+\s*}}$/.test(value);
            const isSafeLink = /^(https?:|mailto:|\/)/i.test(value);
            if (isVariable) return `${name}="${value}"`;
            if (!isVariable && !isSafeLink) return "";
          }

          return undefined;
        },
      });
    }

    return xss(value, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script", "style"],
    });
  };

  /**
   * Duyệt đệ quy object/array, nhận diện context để chọn chế độ sanitize.
   * @param {*} value - giá trị cần sanitize
   * @param {string|null} parentKey - tên key cha (để nhận diện rich-text field)
   */
  const sanitizeValue = (value, parentKey = null) => {
    if (typeof value === "string") {
      const currentKey = parentKey || "";

      if (
        isEmailTemplateAdminRequest &&
        EMAIL_TEMPLATE_CONTENT_FIELDS.has(currentKey)
      ) {
        return sanitizeString(value, "emailTemplateHtml");
      }

      if (isEmailTemplateHtmlField(currentKey)) {
        return sanitizeString(value, "emailTemplateHtml");
      }

      const isRichText = parentKey !== null && RICH_TEXT_FIELDS.has(parentKey);
      return sanitizeString(value, isRichText ? "richText" : "plain");
    }
    if (Array.isArray(value)) {
      // Mảng ví dụ (examples) – các phần tử là object {vi, en, lo}
      return value.map((item) => sanitizeValue(item, parentKey));
    }
    if (typeof value === "object" && value !== null) {
      const clean = {};
      for (const key in value) {
        clean[key] = sanitizeValue(value[key], key);
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

  // Ẩn thông tin máy chủ
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // Bảo mật CORS bổ sung
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
