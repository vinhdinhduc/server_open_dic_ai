const crypto = require("crypto");

const tokenStore = new Map();

/**
 * Generate CSRF token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Middleware tạo và gửi CSRF token
 */
const csrfTokenGenerator = (req, res, next) => {
  // Chỉ tạo token cho yêu cầu GET
  if (req.method === "GET") {
    const token = generateToken();
    const sessionId =
      req.cookies?.sessionId ||
      req.headers["x-session-id"] ||
      crypto.randomBytes(16).toString("hex");

    // Lưu token với sessionId
    tokenStore.set(sessionId, {
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    // Gửi token cho client
    res.cookie("XSRF-TOKEN", token, {
      httpOnly: false, // Client cần đọc được để gửi lại
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 giờ
    });

    // Gửi sessionId
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000,
    });

    // Gắn token vào request để sử dụng ở bước sau
    req.csrfToken = () => token;
  }

  next();
};

/**
 * Middleware verify CSRF token
 */
const csrfProtection = (req, res, next) => {
  // Bỏ qua kiểm tra CSRF cho:
  // - GET, HEAD, OPTIONS requests (safe methods)
  // - Yêu cầu dùng JWT Bearer token (xác thực bằng token không cần CSRF)
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  const hasJWTAuth = req.headers.authorization?.startsWith("Bearer ");

  if (safeMethods.includes(req.method) || hasJWTAuth) {
    return next();
  }

  // Lấy token từ header hoặc body
  const clientToken =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf ||
    req.query?._csrf;

  // Lấy sessionId
  const sessionId = req.cookies?.sessionId || req.headers["x-session-id"];

  if (!clientToken || !sessionId) {
    return res.status(403).json({
      error: "CSRF token missing",
      message: "Token CSRF không hợp lệ hoặc thiếu",
    });
  }

  // Xác minh token
  const storedData = tokenStore.get(sessionId);

  if (!storedData) {
    return res.status(403).json({
      error: "CSRF token invalid",
      message: "Token CSRF không tồn tại hoặc đã hết hạn",
    });
  }

  // Kiểm tra thời hạn
  if (Date.now() > storedData.expiresAt) {
    tokenStore.delete(sessionId);
    return res.status(403).json({
      error: "CSRF token expired",
      message: "Token CSRF đã hết hạn",
    });
  }

  // Xác minh token khớp
  if (storedData.token !== clientToken) {
    console.warn(`[Security] CSRF token mismatch from IP: ${req.ip}`);
    return res.status(403).json({
      error: "CSRF token mismatch",
      message: "Token CSRF không khớp",
    });
  }

  // Token hợp lệ - xóa và tạo token mới (one-time use)
  tokenStore.delete(sessionId);

  next();
};

/**
 * Cleanup expired tokens (chạy định kỳ)
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [sessionId, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(sessionId);
    }
  }
};

setInterval(cleanupExpiredTokens, 10 * 60 * 1000);

/**
 * Double Submit Cookie Pattern (Alternative approach)
 * Đơn giản hơn, không cần server-side storage
 */
const doubleSubmitCookie = {
  // Generate và set cookie
  setCsrfToken: (req, res, next) => {
    if (req.method === "GET") {
      const token = generateToken();
      res.cookie("XSRF-TOKEN", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000,
      });
      req.csrfToken = () => token;
    }
    next();
  },

  // Xác minh token
  verifyCsrfToken: (req, res, next) => {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    const hasJWTAuth = req.headers.authorization?.startsWith("Bearer ");

    if (safeMethods.includes(req.method) || hasJWTAuth) {
      return next();
    }

    const cookieToken = req.cookies?.["XSRF-TOKEN"];
    const headerToken =
      req.headers["x-csrf-token"] || req.headers["x-xsrf-token"];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      console.warn(`[Security] CSRF validation failed from IP: ${req.ip}`);
      return res.status(403).json({
        error: "CSRF validation failed",
        message: "Token CSRF không hợp lệ",
      });
    }

    next();
  },
};

/**
 * Endpoint để lấy CSRF token
 */
const getCsrfToken = (req, res) => {
  const token = req.csrfToken ? req.csrfToken() : generateToken();
  res.json({ csrfToken: token });
};

module.exports = {
  csrfTokenGenerator,
  csrfProtection,
  doubleSubmitCookie,
  getCsrfToken,
  cleanupExpiredTokens,
};
