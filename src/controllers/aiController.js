const aiService = require("../services/aiService");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Controller xử lý các yêu cầu AI
 */

/**
 * Hỏi AI về thuật ngữ
 * POST /api/ai/ask
 */
const askAboutTerm = async (req, res) => {
  try {
    const { term, language = "vi" } = req.body;
    const userId = req.user.id;

    // Validation
    if (!term || term.trim().length === 0) {
      return errorResponse(res, "Vui lòng nhập thuật ngữ cần tìm hiểu", 400);
    }

    if (term.length > 200) {
      return errorResponse(res, "Thuật ngữ không được vượt quá 200 ký tự", 400);
    }

    const validLanguages = ["vi", "en", "lo"];
    if (!validLanguages.includes(language)) {
      return errorResponse(res, "Ngôn ngữ không hợp lệ", 400);
    }

    // Gọi AI service
    const result = await aiService.askAboutTerm(term, language, userId);

    if (result.success) {
      return successResponse(res, "Đã nhận được phản hồi từ AI", result.data);
    } else {
      return errorResponse(res, "Không thể kết nối với dịch vụ AI", 500);
    }
  } catch (error) {
    console.error("AI Controller Error:", error);
    return errorResponse(res, "Đã có lỗi xảy ra khi xử lý yêu cầu AI", 500);
  }
};

/**
 * Lấy lịch sử chat AI
 * GET /api/ai/history
 */
const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const result = await aiService.getChatHistory(userId, limit);

    return successResponse(res, "Lấy lịch sử chat thành công", result.data);
  } catch (error) {
    console.error("Get Chat History Error:", error);
    return errorResponse(res, "Đã có lỗi xảy ra khi lấy lịch sử chat", 500);
  }
};

/**
 * Kiểm tra trạng thái dịch vụ AI
 * GET /api/ai/status
 */
const getAIStatus = async (req, res) => {
  try {
    const status = await aiService.getStatus();
    return successResponse(res, "Lấy trạng thái AI thành công", status);
  } catch (error) {
    console.error("Get AI Status Error:", error);
    return errorResponse(res, "Không thể kiểm tra trạng thái AI", 500);
  }
};

/**
 * Lấy cấu hình AI hiện tại (Admin only)
 * GET /api/ai/config
 */
const getConfig = async (req, res) => {
  try {
    const config = await aiService.getAIConfig();

    // Ẩn một phần API key để bảo mật
    const maskedConfig = {
      ...config,
      apiKey: config.apiKey
        ? `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`
        : "",
      hasApiKey: !!config.apiKey,
    };

    return successResponse(res, "Lấy cấu hình AI thành công", maskedConfig);
  } catch (error) {
    console.error("Get AI Config Error:", error);
    return errorResponse(res, "Không thể lấy cấu hình AI", 500);
  }
};

/**
 * Cập nhật cấu hình AI (Admin only)
 * PUT /api/ai/config
 */
const updateConfig = async (req, res) => {
  try {
    const { apiKey, provider, model, temperature, maxTokens } = req.body;
    const userId = req.user.id;

    // Validation
    if (provider && !["gemini", "openai"].includes(provider)) {
      return errorResponse(
        res,
        "Provider không hợp lệ. Chỉ hỗ trợ: gemini, openai",
        400,
      );
    }

    if (temperature !== undefined) {
      const temp = parseFloat(temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return errorResponse(res, "Temperature phải là số từ 0 đến 2", 400);
      }
    }

    if (maxTokens !== undefined) {
      const tokens = parseInt(maxTokens);
      if (isNaN(tokens) || tokens < 100 || tokens > 4000) {
        return errorResponse(res, "Max tokens phải là số từ 100 đến 4000", 400);
      }
    }

    const result = await aiService.updateConfig(
      { apiKey, provider, model, temperature, maxTokens },
      userId,
    );

    return successResponse(res, result.message, result.config);
  } catch (error) {
    console.error("Update AI Config Error:", error);
    return errorResponse(res, "Không thể cập nhật cấu hình AI", 500);
  }
};

/**
 * Test kết nối AI (Admin only)
 * POST /api/ai/test
 */
const testConnection = async (req, res) => {
  try {
    const result = await aiService.testConnection();

    if (result.success) {
      return successResponse(res, "Test kết nối thành công", result);
    } else {
      return errorResponse(res, result.message, 400);
    }
  } catch (error) {
    console.error("Test AI Connection Error:", error);
    return errorResponse(res, "Không thể test kết nối AI", 500);
  }
};

module.exports = {
  askAboutTerm,
  getChatHistory,
  getAIStatus,
  getConfig,
  updateConfig,
  testConnection,
};
