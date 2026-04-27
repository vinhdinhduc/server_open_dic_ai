const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("./config/passport");
const errorHandler = require("./middlewares/errorHandler");

// Import security middlewares
const {
  helmetConfig,
  noSqlInjectionProtection,
  xssProtection,
  parameterPollutionProtection,
  customSecurityHeaders,
  securityLogger,
  inputSanitization,
} = require("./middlewares/security");

const { generalLimiter, apiLimiter } = require("./middlewares/rateLimiter");

const { doubleSubmitCookie } = require("./middlewares/csrf");

// Import routes
const authRoutes = require("./routes/authRoutes");
const termRoutes = require("./routes/termRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const commentRoutes = require("./routes/commentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const aiRoutes = require("./routes/aiRoutes");
const aiAgentRoutes = require("./routes/aiAgentRoutes");
const systemConfigRoutes = require("./routes/systemConfigRoutes");
const reportStatsRoutes = require("./routes/reportStatsRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const reputationRoutes = require("./routes/reputationRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

const app = express();

// 1. Helmet - HTTP Security Headers (chống XSS, Clickjacking, etc.)
app.use(helmetConfig);

// 2. Custom security headers
app.use(customSecurityHeaders);

// 3. Cookie parser (cần cho CSRF)
app.use(cookieParser());

// 4. Express session (bắt buộc cho Passport)
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your_session_secret_change_in_production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Chỉ dùng HTTPS trong production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// 5. Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// 6. CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true, // Cho phép gửi cookies
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-XSRF-Token",
    "X-Requested-With",
  ],
};
app.use(cors(corsOptions));

// 7. Body parsers (giới hạn kích thước để chống DoS)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 8. Security logger (log các requests đáng ngờ)
app.use(securityLogger);

// 9. NoSQL Injection protection
app.use(noSqlInjectionProtection);

// 10. XSS protection
app.use(xssProtection);

// 11. HTTP Parameter Pollution protection
app.use(parameterPollutionProtection);

// 12. Input sanitization (trim whitespace, etc.)
app.use(inputSanitization);

// 13. Morgan logging (đặt trước rate limiter để log tất cả requests)
app.use(morgan("dev"));

// 14. Bộ tạo CSRF token (chỉ cho yêu cầu GET)
// Lưu ý: CSRF chỉ cần khi dùng cookie-based auth
// Nếu dùng JWT trong header thì không cần
if (process.env.USE_CSRF === "true") {
  app.use(doubleSubmitCookie.setCsrfToken);
}

// 15. Rate limiting - Áp dụng API rate limiter cho tất cả API routes
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/terms", termRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai/agent", aiAgentRoutes);
app.use("/api/system-config", systemConfigRoutes);
app.use("/api/report-stats", reportStatsRoutes);
app.use("/api/contact", feedbackRoutes);
app.use("/api/reputation", reputationRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

// Kiểm tra sức khỏe dịch vụ (không áp dụng rate limit)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Endpoint kiểm thử bảo mật (chỉ cho môi trường development)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/security-test", (req, res) => {
    res.json({
      headers: req.headers,
      cookies: req.cookies,
      ip: req.ip,
      csrfToken: req.csrfToken ? req.csrfToken() : "N/A",
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "Endpoint không tồn tại",
    path: req.path,
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
