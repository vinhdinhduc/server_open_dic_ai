const { errorResponse } = require("../utils/response");

const verifyRecaptcha = async (req, res, next) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // Skip nếu không cấu hình reCAPTCHA
  if (!secretKey) {
    return next();
  }

  const token = req.body.recaptchaToken || req.headers["x-recaptcha-token"];

  if (!token) {
    return errorResponse(res, "Vui lòng xác thực reCAPTCHA", 400);
  }

  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      },
    );

    const data = await response.json();

    if (!data.success || (data.score !== undefined && data.score < 0.5)) {
      return errorResponse(
        res,
        "Xác thực reCAPTCHA thất bại. Vui lòng thử lại.",
        403,
      );
    }

    next();
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    // Cho phép nếu reCAPTCHA service lỗi (graceful degradation)
    next();
  }
};

module.exports = { verifyRecaptcha };
