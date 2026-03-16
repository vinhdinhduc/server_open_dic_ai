const aiService = require("../services/aiService");
const reputationService = require("../services/reputationService");
const { REPUTATION } = require("../utils/constants");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Controller xử lý các yêu cầu AI
 */

const ensureExplanationAIAccess = async (userId) => {
  const access = await reputationService.checkAIAccess(userId, "explanation");
  if (access.allowed) {
    return null;
  }

  const requiredLevel = Object.values(REPUTATION.LEVELS).find((level) =>
    level.features.includes("explanation"),
  );

  if (!requiredLevel) {
    return "Bạn chưa đủ điểm uy tín để sử dụng tính năng AI này";
  }

  return `Bạn chưa đủ điểm uy tín để dùng AI giải thích thêm về thuật ngữ. Cần tối thiểu ${requiredLevel.min} điểm uy tín (${requiredLevel.name}).`;
};

const ensureSpecificTermExplanationAccess = async (userId, userRole) => {
  // Admin và moderator luôn có quyền truy cập AI không giới hạn
  if (userRole === "admin" || userRole === "moderator") {
    return null;
  }

  const access = await reputationService.checkAIAccess(userId, "explanation");
  const requiredLevel = REPUTATION.LEVELS[2];

  if (access.allowed && access.level >= 2) {
    return null;
  }

  return `Bạn chưa đủ điểm uy tín để dùng AI giải thích thêm về thuật ngữ đã có sẵn. Cần tối thiểu ${requiredLevel.min} điểm uy tín (${requiredLevel.name}).`;
};

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
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      return errorResponse(res, "Thuật ngữ phải có ít nhất 2 ký tự", 400);
    }
    if (trimmed.length > 100) {
      return errorResponse(res, "Thuật ngữ không được vượt quá 100 ký tự", 400);
    }
    //Chặn  chuỗi vô nghĩa

    const hasValidChar = /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed);
    if (!hasValidChar) {
      return errorResponse(res, "Thuật ngữ phải chứa ký tự hợp lệ", 400);
    }

    //Chặn kí tự đặc biệt nguy hiểm
    const hasDangerousChar = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /you\s+are\s+now/i,
      /act\s+as/i,
      /system\s*:/i,
      /\[INST\]/i,
      /<\|.*?\|>/,
      /```[\s\S]*?```/,
    ];
    const isInjection = hasDangerousChar.some((regex) => regex.test(trimmed));
    if (isInjection) {
      return errorResponse(res, "Thuật ngữ chứa nội dung không hợp lệ", 400);
    }

    const specialCharsRatio =
      trimmed.match(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g)?.length /
        trimmed.length || 0;

    if (specialCharsRatio > 0.3) {
      return errorResponse(res, "Thuật ngữ chứa quá nhiều ký tự đặc biệt", 400);
    }

    const hasRepetitiveChars = /(.)\1{4,}/.test(trimmed);
    if (hasRepetitiveChars) {
      return errorResponse(res, "Thuật ngữ chứa quá nhiều ký tự lặp lại", 400);
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
    const {
      apiKey,
      provider,
      model,
      temperature,
      maxTokens,
      promptDefinition,
      promptExplanation,
      promptAnswer,
    } = req.body;
    const userId = req.user.id;

    // Validation
    if (provider && !["gemini", "openai", "grok"].includes(provider)) {
      return errorResponse(
        res,
        "Provider không hợp lệ. Chỉ hỗ trợ: gemini, openai, grok",
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
      if (isNaN(tokens) || tokens < 100 || tokens > 8192) {
        return errorResponse(res, "Max tokens phải là số từ 100 đến 8192", 400);
      }
    }

    const result = await aiService.updateConfig(
      {
        apiKey,
        provider,
        model,
        temperature,
        maxTokens,
        promptDefinition,
        promptExplanation,
        promptAnswer,
      },
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

/**
 * AI trả lời câu hỏi về thuật ngữ cụ thể (từ trang chi tiết)
 * POST /api/ai/ask-about-term
 */
const askAboutSpecificTerm = async (req, res) => {
  try {
    const { termId, question, language = "vi" } = req.body;
    const userId = req.user.id;

    if (!termId) {
      return errorResponse(res, "termId là bắt buộc", 400);
    }

    const accessError = await ensureExplanationAIAccess(userId);
    if (accessError) {
      return errorResponse(res, accessError, 403);
    }

    const Term = require("../models/Term");
    const AICache = require("../models/AICache");

    // Check cache first (only when no custom question)
    if (!question) {
      const cached = await AICache.findOne({ termId, language }).lean();
      if (cached && cached.response) {
        return successResponse(res, "Đã nhận được phản hồi từ AI (cache)", {
          ...cached.response,
          cached: true,
        });
      }
    }

    const termDoc = await Term.findById(termId)
      .populate("category", "name")
      .populate("relatedTerms", "term");

    if (!termDoc) {
      return errorResponse(res, "Không tìm thấy thuật ngữ", 404);
    }

    const termName =
      termDoc.term?.[language] || termDoc.term?.vi || termDoc.term?.en || "";
    const definition =
      termDoc.definition?.[language] || termDoc.definition?.vi || "";
    const explanation =
      termDoc.detailedExplanation?.[language] ||
      termDoc.detailedExplanation?.vi ||
      "";
    const categoryName =
      termDoc.category?.name?.[language] || termDoc.category?.name?.vi || "";
    const relatedNames = (termDoc.relatedTerms || [])
      .map((r) => r.term?.[language] || r.term?.vi || "")
      .filter(Boolean)
      .join(", ");

    const contextPrompt = question
      ? `Thuật ngữ: "${termName}"\nDanh mục: ${categoryName}\nĐịnh nghĩa hiện tại: ${definition}\nGiải thích: ${explanation}\nTừ liên quan: ${relatedNames}\n\nCâu hỏi của người dùng: ${question}`
      : termName;

    const result = await aiService.askAboutTerm(
      contextPrompt,
      language,
      userId,
    );

    if (result.success) {
      // Save to cache (only standard term queries, not custom questions)
      if (!question && result.data) {
        const cacheData = {
          definition: result.data.definition,
          detailedExplanation: result.data.detailedExplanation,
          examples: result.data.examples,
          partOfSpeech: result.data.partOfSpeech,
          field: result.data.field,
          relatedTerms: result.data.relatedTerms,
          tags: result.data.tags,
        };
        await AICache.findOneAndUpdate(
          { termId, language },
          {
            response: cacheData,
            provider: result.data.provider,
            model: result.data.model,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          { upsert: true },
        ).catch((err) => console.error("AI cache save error:", err));
      }
      return successResponse(res, "Đã nhận được phản hồi từ AI", result.data);
    } else {
      return errorResponse(res, "Không thể kết nối với dịch vụ AI", 500);
    }
  } catch (error) {
    console.error("AI Ask About Term Error:", error);
    return errorResponse(res, "Đã có lỗi xảy ra", 500);
  }
};

/**
 * Lấy thống kê sử dụng API trong ngày (Admin only)
 * GET /api/ai/usage
 */
const getAPIUsage = async (req, res) => {
  try {
    const stats = aiService.getAPIUsageStats();
    const SystemConfig = require("../models/SystemConfig");
    const maxDailyRequests = await SystemConfig.getValue(
      "ai_max_daily_requests",
      1000,
    );
    const maxDailyTokens = await SystemConfig.getValue(
      "ai_max_daily_tokens",
      500000,
    );

    return successResponse(res, "Lấy thống kê API thành công", {
      ...stats,
      maxDailyRequests,
      maxDailyTokens,
      requestPercent: ((stats.requestCount / maxDailyRequests) * 100).toFixed(
        1,
      ),
      tokenPercent:
        maxDailyTokens > 0
          ? ((stats.tokenCount / maxDailyTokens) * 100).toFixed(1)
          : "0",
    });
  } catch (error) {
    console.error("Get API Usage Error:", error);
    return errorResponse(res, "Không thể lấy thống kê API", 500);
  }
};

module.exports = {
  askAboutTerm,
  getChatHistory,
  getAIStatus,
  getConfig,
  updateConfig,
  testConnection,
  askAboutSpecificTerm,
  getAPIUsage,
};
