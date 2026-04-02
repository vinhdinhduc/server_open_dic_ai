const SystemConfig = require("../models/SystemConfig");
const AIUsageDaily = require("../models/AIUsageDaily");
const notificationService = require("./notificationService");
const termService = require("./termService");
const { NOTIFICATION_TYPES } = require("../utils/constants");

const SUPPORTED_LANGUAGES = new Set(["vi", "en", "lo"]);

const normalizeLanguage = (language) => {
  if (!language || typeof language !== "string") {
    return "vi";
  }
  const normalized = language.toLowerCase();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "vi";
};

const getLocalizedText = (multiLangText, language = "vi") => {
  if (!multiLangText || typeof multiLangText !== "object") {
    return "";
  }
  return (
    multiLangText[language] ||
    multiLangText.vi ||
    multiLangText.en ||
    multiLangText.lo ||
    ""
  );
};

const hasDictionarySignal = (query = "") => {
  const normalized = query.toLowerCase();
  const keywords = [
    "từ điển",
    "thuật ngữ",
    "định nghĩa",
    "dịch",
    "đồng nghĩa",
    "opendict",
    "utb",
    "dictionary",
    "term",
    "definition",
    "translate",
    "synonym",
    "register",
    "login",
    "contribute",
    "moderate",
    "phân loại",
    "lĩnh vực",
  ];

  return keywords.some((keyword) => normalized.includes(keyword));
};

const isLikelyOutOfScope = (query = "") => {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }

  // Single/short phrases are usually term lookups.
  if (trimmed.split(/\s+/).length <= 3 && trimmed.length <= 40) {
    return false;
  }

  if (hasDictionarySignal(trimmed)) {
    return false;
  }

  const outOfScopePatterns = [
    /thời tiết|weather|forecast/i,
    /chứng khoán|bitcoin|coin|crypto|stock price/i,
    /viết code|lập trình|debug code|create app|build website/i,
    /nấu ăn|công thức|recipe|calories/i,
    /du lịch|đặt vé|book flight|hotel/i,
    /bói toán|tử vi|horoscope|fortune/i,
    /tin tức|news today|headline/i,
    /game|cheat|hack game/i,
  ];

  return outOfScopePatterns.some((regex) => regex.test(trimmed));
};

const getScopeRefusalMessage = (language = "vi") => {
  const messages = {
    vi: "Mình chỉ hỗ trợ nội dung liên quan đến từ điển, thuật ngữ và hệ thống UTB OpenDict. Bạn có thể hỏi về định nghĩa thuật ngữ, dịch Anh-Việt-Lào, cách đăng ký/đăng nhập, đóng góp hoặc duyệt thuật ngữ.",
    en: "I can only help with dictionary terms and the UTB OpenDict system. You can ask about term definitions, EN-VI-LO translation, or how to register, log in, contribute, and moderate terms.",
    lo: "ຂ້ອຍສາມາດຊ່ວຍໄດ້ສະເພາະເນື້ອຫາທີ່ກ່ຽວກັບວັດຈະນານຸກົມ, ຄຳສັບ ແລະ ລະບົບ UTB OpenDict. ທ່ານສາມາດຖາມເລື່ອງຄຳນິຍາມ, ການແປ EN-VI-LO, ການລົງທະບຽນ, ເຂົ້າລະບົບ, ການສົ່ງຄຳສັບ ແລະ ການກວດອະນຸມັດ.",
  };

  return messages[language] || messages.vi;
};

const getPageGuide = (context = {}, language = "vi") => {
  const page = (context.currentPage || "").toLowerCase();

  const guides = {
    vi: {
      login:
        "Người dùng đang ở trang đăng nhập. Ưu tiên hướng dẫn cách đăng nhập, quên mật khẩu, hoặc chuyển sang đăng ký.",
      register:
        "Người dùng đang ở trang đăng ký. Ưu tiên hướng dẫn điền thông tin đăng ký và xác thực tài khoản.",
      terms:
        "Người dùng đang ở khu vực tra cứu thuật ngữ. Ưu tiên gợi ý cách tìm kiếm, lọc danh mục, và khám phá thuật ngữ liên quan.",
      term: "Người dùng đang xem chi tiết thuật ngữ. Ưu tiên giải thích thuật ngữ hiện tại, so sánh thuật ngữ liên quan, và gợi ý thao tác chỉnh sửa/đóng góp.",
      contribute:
        "Người dùng đang ở trang đóng góp thuật ngữ. Ưu tiên hướng dẫn cách thêm thuật ngữ, viết định nghĩa rõ ràng, thêm ví dụ, chọn lĩnh vực và gửi duyệt.",
      moderator:
        "Người dùng đang ở trang duyệt/quản lý thuật ngữ. Ưu tiên giải thích quy trình duyệt, phản hồi đóng góp, và tiêu chí chất lượng thuật ngữ.",
      profile:
        "Người dùng đang ở trang cá nhân. Có thể gợi ý xem uy tín, lịch sử tìm kiếm, đóng góp và yêu thích.",
    },
    en: {
      login:
        "User is on the login page. Focus on sign-in steps, forgot password flow, and switching to registration.",
      register:
        "User is on the registration page. Focus on account creation steps and profile completion.",
      terms:
        "User is browsing/searching terms. Focus on search tips, category filters, and related term discovery.",
      term: "User is viewing a term detail page. Focus on understanding this term and related terms, with edit/contribution guidance.",
      contribute:
        "User is on the contribution page. Focus on adding a quality term, clear definition, examples, field classification, and submission flow.",
      moderator:
        "User is in moderation area. Focus on review workflow and quality criteria for term approval.",
      profile:
        "User is on profile area. Suggest reputation, search history, favorites, and contribution tracking.",
    },
    lo: {
      login:
        "ຜູ້ໃຊ້ກຳລັງຢູ່ໜ້າ login. ແນະນຳຂັ້ນຕອນເຂົ້າລະບົບ ແລະ ການຟື້ນລະຫັດຜ່ານ.",
      register: "ຜູ້ໃຊ້ກຳລັງຢູ່ໜ້າ register. ແນະນຳວິທີສ້າງບັນຊີໃຫ້ຖືກຕ້ອງ.",
      terms:
        "ຜູ້ໃຊ້ກຳລັງຄົ້ນຫາຄຳສັບ. ແນະນຳວິທີຄົ້ນຫາ, ກອງຕາມໝວດ, ແລະ ຄົ້ນພົບຄຳສັບທີ່ກ່ຽວຂ້ອງ.",
      term: "ຜູ້ໃຊ້ກຳລັງເບິ່ງລາຍລະອຽດຄຳສັບ. ແນະນຳການເຂົ້າໃຈຄຳສັບນີ້ ແລະ ຄຳສັບທີ່ກ່ຽວຂ້ອງ.",
      contribute:
        "ຜູ້ໃຊ້ກຳລັງຢູ່ໜ້າສົ່ງຄຳສັບ. ແນະນຳການເພີ່ມຄຳສັບ, ຂຽນຄຳນິຍາມ, ຕົວຢ່າງ ແລະ ສົ່ງກວດ.",
      moderator:
        "ຜູ້ໃຊ້ກຳລັງຢູ່ພື້ນທີ່ກວດອະນຸມັດ. ແນະນຳຂັ້ນຕອນການກວດ ແລະ ມາດຕະຖານຄຸນນະພາບ.",
      profile:
        "ຜູ້ໃຊ້ກຳລັງຢູ່ໜ້າໂປຣໄຟລ໌. ສາມາດແນະນຳການເບິ່ງຄະແນນຄວາມນ່າເຊື່ອຖື ແລະ ປະຫວັດການໃຊ້ງານ.",
    },
  };

  const langGuides = guides[language] || guides.vi;
  return langGuides[page] || "";
};

const buildAssistantPrompt = ({ query, language = "vi", context = {} }) => {
  const pageGuide = getPageGuide(context, language);

  const systemKnowledge = {
    vi: `Bạn là trợ lý AI của hệ thống UTB OpenDict.
Mục tiêu: trả lời tự nhiên, thân thiện, rõ ràng, dễ hiểu như người thật.

PHẠM VI BẮT BUỘC:
- Chỉ trả lời nội dung liên quan: từ điển, thuật ngữ, UTB OpenDict.
- Nếu câu hỏi ngoài phạm vi: từ chối lịch sự và gợi ý người dùng hỏi lại theo đúng phạm vi.

TRI THỨC HỆ THỐNG UTB OpenDict:
- Nền tảng từ điển thuật ngữ đa ngôn ngữ (Việt - Anh - Lào).
- Chức năng chính: tra cứu thuật ngữ, đăng ký/đăng nhập, đóng góp thuật ngữ, duyệt và quản lý thuật ngữ.
- Hướng dẫn sử dụng:
  + Đăng ký: vào trang register, điền thông tin, xác thực tài khoản.
  + Đăng nhập: vào trang login, nhập email và mật khẩu.
  + Thêm thuật ngữ: vào trang contribute, nhập thuật ngữ + định nghĩa + ví dụ + lĩnh vực.
  + Chỉnh sửa/đóng góp: vào trang chi tiết thuật ngữ để gợi ý chỉnh sửa hoặc gửi đóng góp mới.

NĂNG LỰC AI CHO THUẬT NGỮ:
- Nhận diện thuật ngữ.
- Phân loại lĩnh vực (CNTT, Toán, Y học, ...).
- Dịch thuật ngữ giữa Anh - Việt - Lào.
- Gợi ý từ đồng nghĩa hoặc liên quan.

FORMAT ĐẦU RA:
- KHÔNG bắt buộc JSON.
- Linh hoạt theo nội dung: đoạn văn ngắn, danh sách bullet, hoặc gợi ý hành động.
- Ưu tiên câu ngắn, rõ ý, tránh dài dòng.

${pageGuide ? `NGỮ CẢNH TRANG HIỆN TẠI: ${pageGuide}` : ""}`,
    en: `You are the UTB OpenDict AI assistant.
Goal: respond naturally, clearly, and helpfully like a human assistant.

REQUIRED SCOPE:
- Only answer topics related to dictionary terms and UTB OpenDict.
- For out-of-scope queries, politely refuse and ask the user to rephrase within scope.

UTB OpenDict KNOWLEDGE:
- Multilingual terminology dictionary platform (Vietnamese, English, Lao).
- Main features: term lookup, register/login, term contribution, term moderation/management.
- Usage guides:
  + Register: open register page, submit account info.
  + Login: open login page, use email and password.
  + Add term: open contribute page, provide term, definition, examples, and field.
  + Edit/contribute: open term detail, suggest edits or submit new contribution.

AI TERM CAPABILITIES:
- Term recognition.
- Domain classification.
- EN-VI-LO translation.
- Synonym and related-term suggestions.

OUTPUT FORMAT:
- Do NOT force JSON.
- Use flexible output: short text, bullet points, or actionable suggestions.
- Keep answers concise, friendly, and easy to follow.

${pageGuide ? `CURRENT PAGE CONTEXT: ${pageGuide}` : ""}`,
    lo: `ທ່ານແມ່ນຜູ້ຊ່ວຍ AI ຂອງ UTB OpenDict.
ເປົ້າໝາຍ: ຕອບໃຫ້ເປັນທຳມະຊາດ, ຊັດເຈນ, ເຂົ້າໃຈງ່າຍ.

ຂອບເຂດບັງຄັບ:
- ຕອບສະເພາະເນື້ອຫາທີ່ກ່ຽວກັບຄຳສັບ, ວັດຈະນານຸກົມ ແລະ UTB OpenDict.
- ຖ້ານອກຂອບເຂດ ໃຫ້ປະຕິເສດຢ່າງສຸພາບ.

ຄວາມຮູ້ກ່ຽວກັບ UTB OpenDict:
- ລະບົບວັດຈະນານຸກົມຫຼາຍພາສາ (VI-EN-LO).
- ຟັງຊັນຫຼັກ: ຄົ້ນຫາຄຳສັບ, ລົງທະບຽນ/ເຂົ້າລະບົບ, ສົ່ງຄຳສັບ, ກວດອະນຸມັດ/ຈັດການ.

ຄວາມສາມາດ AI ດ້ານຄຳສັບ:
- ຈຳແນກຄຳສັບ.
- ຈັດປະເພດສາຂາ.
- ແປຄຳສັບ EN-VI-LO.
- ແນະນຳຄຳຄ້າຍຄື ຫຼື ຄຳທີ່ກ່ຽວຂ້ອງ.

ຮູບແບບຄຳຕອບ:
- ບໍ່ຕ້ອງ JSON.
- ໃຊ້ຮູບແບບທີ່ຍືດຫຍຸ່ນ: ຂໍ້ຄວາມສັ້ນ, bullet list, ຫຼື ຂໍ້ແນະນຳ.

${pageGuide ? `ບໍລິບົດໜ້າປັດຈຸບັນ: ${pageGuide}` : ""}`,
  };

  const systemPrompt = systemKnowledge[language] || systemKnowledge.vi;

  return `${systemPrompt}\n\nUser question: ${query}`;
};

const stripMarkdownFence = (text = "") => {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(/^```(?:json|markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
};

const inferResponseFormat = (answer = "") => {
  if (/^\s*[-*]\s+/m.test(answer) || /^\s*\d+\.\s+/m.test(answer)) {
    return "list";
  }
  if (/Gợi ý|Suggestion|ແນະນຳ/i.test(answer)) {
    return "suggestions";
  }
  return "text";
};

const buildRelatedTermLinksFromQuery = async (query, language = "vi") => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const searchResult = await termService.searchTerms(query, {
      limit: 6,
      language,
      sortBy: "relevance",
    });

    const terms = searchResult?.terms || [];
    if (terms.length === 0) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const primaryTerm =
      terms.find((item) => {
        const values = [
          getLocalizedText(item.term, language),
          getLocalizedText(item.term, "vi"),
          getLocalizedText(item.term, "en"),
          getLocalizedText(item.term, "lo"),
        ]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        return values.includes(normalizedQuery);
      }) || terms[0];

    const links = [];
    const seenIds = new Set();

    const addLink = (termDoc) => {
      if (!termDoc || !termDoc._id) {
        return;
      }
      const id = String(termDoc._id);
      if (seenIds.has(id)) {
        return;
      }
      seenIds.add(id);
      links.push({
        id,
        name: getLocalizedText(termDoc.term, language),
        url: `/terms/${id}`,
      });
    };

    addLink(primaryTerm);

    if (
      Array.isArray(primaryTerm.relatedTerms) &&
      primaryTerm.relatedTerms.length
    ) {
      primaryTerm.relatedTerms.forEach((termDoc) => addLink(termDoc));
    }

    if (
      links.length < 5 &&
      primaryTerm.category &&
      (primaryTerm.category._id || primaryTerm.category)
    ) {
      const categoryId = String(
        primaryTerm.category._id || primaryTerm.category,
      );
      const categoryTermsResult = await termService.searchTerms("", {
        category: categoryId,
        limit: 6,
        language,
      });
      const categoryTerms = categoryTermsResult?.terms || [];
      categoryTerms.forEach((termDoc) => addLink(termDoc));
    }

    return links.slice(0, 5);
  } catch (error) {
    console.warn("Failed to build related term links:", error.message);
    return [];
  }
};

// In-memory daily usage counter (resets on server restart or daily)
let dailyUsage = {
  date: new Date().toISOString().split("T")[0],
  requestCount: 0,
  tokenCount: 0,
  notifiedWarning: false,
  notifiedLimit: false,
};

const resetDailyUsageIfNeeded = () => {
  const today = new Date().toISOString().split("T")[0];
  if (dailyUsage.date !== today) {
    dailyUsage = {
      date: today,
      requestCount: 0,
      tokenCount: 0,
      notifiedWarning: false,
      notifiedLimit: false,
    };
  }
};

const trackAPIUsage = async (tokensUsed = 0) => {
  resetDailyUsageIfNeeded();
  const safeTokensUsed = Number.isFinite(tokensUsed)
    ? Math.max(tokensUsed, 0)
    : 0;

  dailyUsage.requestCount++;
  dailyUsage.tokenCount += safeTokensUsed;

  const maxDailyRequests = await SystemConfig.getValue(
    "ai_max_daily_requests",
    1000,
  );
  const maxDailyTokens = await SystemConfig.getValue(
    "ai_max_daily_tokens",
    500000,
  );

  const requestPercent = (dailyUsage.requestCount / maxDailyRequests) * 100;
  const tokenPercent =
    maxDailyTokens > 0 ? (dailyUsage.tokenCount / maxDailyTokens) * 100 : 0;

  // Persist per-day usage for admin statistics charts
  try {
    const dayDate = new Date(`${dailyUsage.date}T00:00:00.000Z`);
    await AIUsageDaily.findOneAndUpdate(
      { dateKey: dailyUsage.date },
      {
        $setOnInsert: { dateKey: dailyUsage.date, date: dayDate },
        $inc: { requestCount: 1, tokenCount: safeTokensUsed },
        $set: {
          maxDailyRequests,
          maxDailyTokens,
        },
      },
      { upsert: true, new: true },
    );
  } catch (persistError) {
    console.error("Persist AI daily usage error:", persistError.message);
  }

  // Warning at 80%
  if (
    !dailyUsage.notifiedWarning &&
    (requestPercent >= 80 || tokenPercent >= 80)
  ) {
    dailyUsage.notifiedWarning = true;
    await notificationService.notifyAdmins({
      type: NOTIFICATION_TYPES.API_LIMIT_WARNING,
      title: " Cảnh báo: API AI sắp đạt giới hạn",
      message: `Sử dụng API hôm nay: ${dailyUsage.requestCount}/${maxDailyRequests} requests (${requestPercent.toFixed(0)}%), ${dailyUsage.tokenCount}/${maxDailyTokens} tokens (${tokenPercent.toFixed(0)}%). Hãy cân nhắc tăng giới hạn hoặc hạn chế sử dụng.`,
      actionUrl: "/admin/settings/api-keys",
    });
  }

  // Limit reached at 100%
  if (
    !dailyUsage.notifiedLimit &&
    (requestPercent >= 100 || tokenPercent >= 100)
  ) {
    dailyUsage.notifiedLimit = true;
    await notificationService.notifyAdmins({
      type: NOTIFICATION_TYPES.API_LIMIT_REACHED,
      title: " API AI đã đạt giới hạn trong ngày",
      message: `API AI đã sử dụng hết giới hạn: ${dailyUsage.requestCount}/${maxDailyRequests} requests, ${dailyUsage.tokenCount}/${maxDailyTokens} tokens. Các yêu cầu mới sẽ trả về phản hồi mẫu cho đến ngày mai.`,
      actionUrl: "/admin/settings/api-keys",
    });
  }

  return {
    limitReached: requestPercent >= 100 || tokenPercent >= 100,
    requestCount: dailyUsage.requestCount,
    tokenCount: dailyUsage.tokenCount,
    maxDailyRequests,
    maxDailyTokens,
  };
};

const getAPIUsageStats = () => {
  resetDailyUsageIfNeeded();
  return { ...dailyUsage };
};

/**
 * Lấy cấu
 * hình AI từ database
 */
const getAIConfig = async () => {
  const apiKey = await SystemConfig.getValue("ai_api_key", "");
  const provider = await SystemConfig.getValue("ai_provider", "gemini");
  const model = await SystemConfig.getValue("ai_model", "gemini-2.5-flash");
  const maxTokens = await SystemConfig.getValue("ai_max_tokens", 8192);
  const promptDefinition = await SystemConfig.getValue(
    "ai_prompt_definition",
    {},
  );
  const promptExplanation = await SystemConfig.getValue(
    "ai_prompt_explanation",
    {},
  );
  const promptAnswer = await SystemConfig.getValue("ai_prompt_answer", {});

  return {
    apiKey,
    provider,
    model,
    maxTokens,
    promptDefinition,
    promptExplanation,
    promptAnswer,
  };
};

const callAiProvider = async (prompt, config, options = {}) => {
  switch (config.provider) {
    case "gemini":
      return await callGeminiAPI(prompt, config, options);
    case "openai":
      return await callOpenAiAPI(prompt, config, options);
    case "grok":
      return await callGrokAPI(prompt, config, options);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
};

const callOpenAiAPI = async (prompt, config, options = {}) => {
  try {
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: config.apiKey });

    const responseMode = options.responseMode || "json";
    const payload = {
      model: config.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.7,
    };

    if (responseMode === "json") {
      payload.response_format = {
        type: "json_object",
      };
    }

    const response = await openai.chat.completions.create(payload);

    const text = response.choices[0].message.content;
    return text;
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    if (error.message && error.message.includes("Incorrect API key")) {
      throw new Error("API không hợp lệ. Vui lòng kiểm tra lại API key.");
    } else if (error.message && error.message.includes("Rate limit exceeded")) {
      throw new Error("Đã vượt quá giới hạn API. Vui lòng thử lại sau.");
    } else if (error.message && error.message.includes("model not found")) {
      throw new Error(
        `Model ${config.model} không khả dụng. Hãy thử các model phổ biến.`,
      );
    }
    throw error;
  }
};

const callGrokAPI = async (prompt, config, options = {}) => {
  try {
    const OpenAI = require("openai");
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: "https://api.x.ai/v1", // Grok dùng base URL khác
    });

    const responseMode = options.responseMode || "json";
    const payload = {
      model: config.model || "grok-3",
      messages: [{ role: "user", content: prompt }],
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.7,
    };

    if (responseMode === "json") {
      payload.response_format = { type: "json_object" };
    }

    const response = await client.chat.completions.create(payload);

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Grok API Error:", error.message);
    throw error;
  }
};

const askAboutTerm = async (term, language = "vi", userId) => {
  try {
    // Lấy cấu hình từ database
    const config = await getAIConfig();

    // Nếu không có API key, trả về mock response
    if (!config.apiKey) {
      return getMockResponse(term, language);
    }

    // Check daily API limits before calling
    const usageCheck = await trackAPIUsage(0);
    if (usageCheck.limitReached) {
      console.warn("AI API daily limit reached, returning mock response");
      return getMockResponse(term, language);
    }

    // Tạo prompt dựa trên ngôn ngữ
    const prompt = generateFullPrompt(term, language, config);

    // Gọi API của nhà cung cấp AI
    const aiResponse = await callAiProvider(prompt, config);

    // Track token usage (estimate from response length)
    const estimatedTokens = Math.ceil(
      (prompt.length + (aiResponse?.length || 0)) / 4,
    );
    await trackAPIUsage(estimatedTokens);

    // Parse AI response thành cấu trúc khớp Term model
    const structuredData = parseAIResponse(aiResponse, term, language, config);
    console.log(" Parsed structure:", {
      term: structuredData.term,
      structured: structuredData.structured,
      hasDefinition: !!structuredData.definition,
      hasExplanation: !!structuredData.detailedExplanation,
      examplesCount: structuredData.examples?.length || 0,
    });

    return {
      success: true,
      data: structuredData,
    };
  } catch (error) {
    console.error("AI Service Error:", error.message);
    return getMockResponse(term, language);
  }
};

/**
 * Gọi Google Gemini API sử dụng SDK
 */
const callGeminiAPI = async (prompt, config, options = {}) => {
  try {
    const { GoogleGenAI } = require("@google/genai");
    const genAI = new GoogleGenAI({ apiKey: config.apiKey });

    // Xử lý tên model nếu có hậu tố "-latest"
    let modelName = config.model;
    if (modelName.endsWith("-latest")) {
      modelName = modelName.replace("-latest", "");
    }

    // Prepare generation config
    const responseMode = options.responseMode || "json";
    const generationConfig = {
      temperature: config.temperature,
      maxOutputTokens: Math.max(config.maxTokens, 2048),
    };

    if (responseMode === "json") {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = {
        type: "OBJECT",
        properties: {
          definition: { type: "STRING" },
          detailedExplanation: { type: "STRING" },
          examples: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          partOfSpeech: { type: "STRING" },
          field: { type: "STRING" },
          relatedTerms: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          tags: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: [
          "definition",
          "detailedExplanation",
          "examples",
          "partOfSpeech",
          "field",
        ],
      };
    }

    // Generate content using @google/genai API
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: generationConfig,
    });

    const text = result.text;

    // Kiểm tra nếu response bị truncated
    if (text.length < 100 || !text.trim().endsWith("}")) {
      console.warn("Response seems truncated or incomplete");
      console.warn("Response preview:", text.substring(0, 200));
    }

    return text;
  } catch (error) {
    console.error("Gemini SDK Error:", error.message);
    console.error("Error stack:", error.stack);

    // Better error messages
    if (error.message.includes("API_KEY_INVALID")) {
      throw new Error("API key không hợp lệ. Vui lòng kiểm tra lại.");
    } else if (error.message.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Đã vượt quá giới hạn API. Vui lòng thử lại sau.");
    } else if (error.message.includes("models/")) {
      throw new Error(
        `Model ${config.model} không khả dụng. Hãy thử gemini-2.5-flash hoặc gemini-1.5-flash.`,
      );
    }

    throw error;
  }
};

/**
 * Tạo prompt đầy đủ
 */
const generateFullPrompt = (term, language, config = {}) => {
  const systemPrompt = getSystemPrompt(language, config);
  const userPrompt = generatePrompt(term, language);

  return `${systemPrompt}\n\n${userPrompt}`;
};

/**
 * Tạo system prompt cho AI — yêu cầu trả về JSON chuẩn cấu trúc Term model
 */
const getSystemPrompt = (language, config = {}) => {
  // Nếu có custom prompt từ DB cho ngôn ngữ hiện tại, sử dụng nó
  const customDefinition =
    config.promptDefinition && typeof config.promptDefinition === "object"
      ? config.promptDefinition[language]
      : "";
  const customExplanation =
    config.promptExplanation && typeof config.promptExplanation === "object"
      ? config.promptExplanation[language]
      : "";

  const jsonSchema = `{
  "definition": "Định nghĩa ngắn gọn, chính xác (1-2 câu)",
  "detailedExplanation": "Giải thích chi tiết, dễ hiểu (khoảng 2 đoạn vừa đủ không quá dài)",
  "examples": ["Ví dụ thực tế 1"],
  "partOfSpeech": "noun | verb | adjective | adverb | phrase | abbreviation",
  "field": "Lĩnh vực chuyên môn",
  "relatedTerms": ["Thuật ngữ liên quan 1", "Thuật ngữ liên quan 2"],
  "tags": ["tag1", "tag2", "tag3"]
}`;

  const prompts = {
    vi: `Bạn là trợ lý AI chuyên về hệ thống từ điển mở OpenDict đa ngôn ngữ.
Nhiệm vụ: giải thích thuật ngữ và trả về JSON chuẩn theo schema sau:
${jsonSchema}

Quy tắc:
- Trả lời bằng tiếng Việt
- definition: ngắn gọn, súc tích, chính xác (1-2 câu)
- detailedExplanation: chi tiết khoảng 2 đoạn vừa đủ không quá dài. Sử dụng \\n để xuống dòng giữa các đoạn
- examples: ít nhất 1 ví dụ thực tế, mỗi ví dụ là 1 câu hoàn chỉnh
- partOfSpeech: chọn MỘT trong: noun, verb, adjective, adverb, phrase, abbreviation
- field: lĩnh vực chuyên môn chính của thuật ngữ
- relatedTerms: 3-5 thuật ngữ liên quan trực tiếp
- tags: 3-5 từ khóa phân loại
- QUAN TRỌNG: Escape đúng các ký tự đặc biệt trong JSON (newline = \\n, quote = \\", backslash = \\\\)
- CHỈ trả về JSON thuần hợp lệ, không thêm text hay markdown code block`,

    en: `You are an AI assistant specialized in technical terminology dictionary.
Task: explain terms and return JSON matching this schema:
${jsonSchema}

Rules:
- Respond in English
- definition: concise, accurate (1-2 sentences)
- detailedExplanation: detailed about 2 paragraphs, not too long. Use \\n for line breaks between paragraphs
- examples: at least 1 real-world example, each a complete sentence
- partOfSpeech: choose ONE from: noun, verb, adjective, adverb, phrase, abbreviation
- field: primary field of expertise
- relatedTerms: 3-5 directly related terms
- tags: 3-5 classification keywords
- IMPORTANT: Properly escape special characters in JSON (newline = \\n, quote = \\", backslash = \\\\)
- Return ONLY valid pure JSON, no extra text or markdown code blocks`,

    lo: `ທ່ານເປັນຜູ້ຊ່ວຍ AI ຊ່ຽວຊານດ້ານວັດຈະນານຸກົມສັບຕ້ານເຕັກນິກ.
ວຽກງານ: ອະທິບາຍສັບຕ້ານ ແລະ ສົ່ງຄືນ JSON ຕາມ schema ນີ້:
${jsonSchema}

ກົດລະບຽບ:
- ຕອບເປັນພາສາລາວ
- definition: ສັ້ນ, ຊັດເຈນ (1-2 ປະໂຫຍກ)
- detailedExplanation: ລາຍລະອຽດ 2 ວັກ, ບໍ່ຍາວເກີນ. ໃຊ້ \\n ເພື່ອຂຶ້ນແຖວໃໝ່
- examples: ຢ່າງໜ້ອຍ 1 ຕົວຢ່າງຕົວຈິງ
- partOfSpeech: ເລືອກ 1 ຈາກ: noun, verb, adjective, adverb, phrase, abbreviation
- field: ຂົງເຂດຊ່ຽວຊານຫຼັກ
- relatedTerms: 3-5 ສັບຕ້ານທີ່ກ່ຽວຂ້ອງ
- tags: 3-5 ຄຳສຳຄັນ
- ສຳຄັນ: Escape ຕົວອັກສອນພິເສດໃນ JSON ຢ່າງຖືກຕ້ອງ
- ສົ່ງຄືນ JSON ທີ່ຖືກຕ້ອງເທົ່ານັ້ນ`,
  };

  let basePrompt = prompts[language] || prompts.vi;

  // Thêm custom prompt từ DB nếu có
  const customParts = [];
  if (customDefinition) {
    customParts.push(`Hướng dẫn thêm cho definition: ${customDefinition}`);
  }
  if (customExplanation) {
    customParts.push(
      `Hướng dẫn thêm cho detailedExplanation: ${customExplanation}`,
    );
  }
  if (customParts.length > 0) {
    basePrompt += `\n\n${customParts.join("\n")}`;
  }

  return basePrompt;
};

/**
 * Tạo prompt cho user
 */
const generatePrompt = (term, language) => {
  const prompts = {
    vi: `Giải thích thuật ngữ: "${term}"`,
    en: `Explain the term: "${term}"`,
    lo: `ອະທິບາຍຄຳສັບ: "${term}"`,
  };

  return prompts[language] || prompts.vi;
};

/**
 * Parse AI response từ JSON thành cấu trúc khớp Term model
 */
const parseAIResponse = (aiResponse, term, language, config) => {
  try {
    let jsonStr = aiResponse.trim();

    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    jsonStr = cleanJsonString(jsonStr);

    const parsed = JSON.parse(jsonStr);

    return {
      term,
      language,
      structured: true,
      definition: parsed.definition || "",
      detailedExplanation: parsed.detailedExplanation || "",
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      partOfSpeech: parsed.partOfSpeech || "",
      field: parsed.field || "",
      relatedTerms: Array.isArray(parsed.relatedTerms)
        ? parsed.relatedTerms
        : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      timestamp: new Date(),
      model: config.model,
      provider: config.provider,
    };
  } catch (e) {
    console.warn(
      "Failed to parse AI JSON, falling back to raw text:",
      e.message,
    );
    console.warn("Raw AI Response:", aiResponse.substring(0, 500));

    return {
      term,
      language,
      structured: false,
      response: aiResponse,
      timestamp: new Date(),
      model: config.model,
      provider: config.provider,
    };
  }
};

/**
 * Làm sạch JSON string để tránh lỗi parse
 */
const cleanJsonString = (jsonStr) => {
  try {
    // Thử parse trực tiếp trước
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {
    let cleaned = jsonStr;
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (e2) {
      console.warn(" Could not clean JSON, returning original");
      return jsonStr;
    }
  }
};

// Trả về mock response khi không có API key hoặc API lỗi

const getMockResponse = (term, language) => {
  const mockData = {
    vi: {
      definition: `"${term}" là một thuật ngữ chưa có trong hệ thống từ điển OpenDict.`,
      detailedExplanation: `Thuật ngữ **"${term}"** hiện chưa có trong cơ sở dữ liệu từ điển của chúng tôi.\n\nĐây có thể là thuật ngữ thuộc các lĩnh vực: Công nghệ thông tin, Y học, Kỹ thuật, Kinh tế, hoặc các ngành khác.\n\n**Gợi ý:**\n- Đóng góp định nghĩa nếu bạn biết về thuật ngữ này\n- Liên hệ với quản trị viên để bổ sung\n- Tìm kiếm trên các nguồn tài liệu tham khảo\n\n*Đây là phản hồi mẫu. Để sử dụng AI thực, Admin cần cấu hình API key trong phần Cài đặt hệ thống.*`,
      examples: [
        `Thuật ngữ "${term}" thường được sử dụng trong ngữ cảnh chuyên ngành.`,
        `Bạn có thể tìm hiểu thêm về "${term}" từ các tài liệu chuyên môn.`,
      ],
      partOfSpeech: "noun",
      field: "Chưa xác định",
      relatedTerms: [],
      tags: ["chưa phân loại"],
    },
    en: {
      definition: `"${term}" is a specialized term not yet available in our dictionary system.`,
      detailedExplanation: `The term **"${term}"** is not yet in our dictionary database.\n\nThis term may belong to fields such as: Information Technology, Medicine, Engineering, Economics, or other industries.\n\n**Suggestions:**\n- Contribute the definition if you know about this term\n- Contact the administrator to add it\n- Search specialized literature sources\n\n*This is a sample response. To use real AI, Admin needs to configure API key in System Settings.*`,
      examples: [
        `The term "${term}" is commonly used in specialized contexts.`,
        `You can learn more about "${term}" from professional literature.`,
      ],
      partOfSpeech: "noun",
      field: "Unspecified",
      relatedTerms: [],
      tags: ["unclassified"],
    },
    lo: {
      definition: `"${term}" ແມ່ນຄຳສັບເຕັກນິກທີ່ຍັງບໍ່ມີໃນລະບົບວັດຈະນານຸກົມ.`,
      detailedExplanation: `ຄຳສັບ **"${term}"** ຍັງບໍ່ມີໃນຖານຂໍ້ມູນວັດຈະນານຸກົມຂອງພວກເຮົາ.\n\nຄຳສັບນີ້ອາດຈະເປັນຂອງຂົງເຂດຕ່າງໆ.\n\n*ນີ້ແມ່ນຄຳຕອບຕົວຢ່າງ. ເພື່ອໃຊ້ AI ຈິງ, Admin ຕ້ອງຕັ້ງຄ່າ API key.*`,
      examples: [
        `ຄຳສັບ "${term}" ຖືກນຳໃຊ້ໃນບໍລິບົດສະເພາະ.`,
        `ທ່ານສາມາດຮຽນຮູ້ເພີ່ມເຕີມກ່ຽວກັບ "${term}" ຈາກເອກະສານຊ່ຽວຊານ.`,
      ],
      partOfSpeech: "noun",
      field: "ຍັງບໍ່ລະບຸ",
      relatedTerms: [],
      tags: ["ຍັງບໍ່ຈັດປະເພດ"],
    },
  };

  const data = mockData[language] || mockData.vi;

  return {
    success: true,
    data: {
      term,
      language,
      structured: true,
      ...data,
      timestamp: new Date(),
      model: "mock",
      provider: "demo",
    },
  };
};

/**
 * Chat với AI Agent theo ngữ cảnh trang, trả lời tự nhiên (không ép JSON)
 */
const askAgentChat = async ({
  query,
  language = "vi",
  context = {},
  userId,
}) => {
  try {
    const normalizedLanguage = normalizeLanguage(language);
    const trimmedQuery = String(query || "").trim();

    if (!trimmedQuery) {
      return {
        success: false,
        message:
          normalizedLanguage === "en"
            ? "Query is required"
            : normalizedLanguage === "lo"
              ? "ຈຳເປັນຕ້ອງມີຄຳຖາມ"
              : "Vui lòng nhập nội dung cần hỏi",
      };
    }

    if (isLikelyOutOfScope(trimmedQuery)) {
      return {
        success: true,
        data: {
          answer: getScopeRefusalMessage(normalizedLanguage),
          format: "text",
          scopeStatus: "rejected",
          relatedTerms: [],
          suggestions: [],
          provider: "scope-guard",
          model: "rule-based",
          timestamp: new Date(),
        },
      };
    }

    const relatedTerms = await buildRelatedTermLinksFromQuery(
      trimmedQuery,
      normalizedLanguage,
    );

    const config = await getAIConfig();
    if (!config.apiKey) {
      const fallbackByLanguage = {
        vi: `Mình đang ở chế độ demo nên chưa gọi được AI nâng cao.\n\nBạn có thể hỏi về định nghĩa thuật ngữ, cách dùng chức năng trong UTB OpenDict, hoặc thử dịch thuật ngữ giữa Anh - Việt - Lào.`,
        en: `The assistant is currently in demo mode, so advanced AI is not available yet.\n\nYou can still ask about term definitions, UTB OpenDict usage, or EN-VI-LO term translation.`,
        lo: `ລະບົບກຳລັງຢູ່ໂໝດ demo ຈຶ່ງຍັງບໍ່ສາມາດໃຊ້ AI ຂັ້ນສູງໄດ້.\n\nທ່ານຍັງສາມາດຖາມເລື່ອງຄຳນິຍາມ, ການໃຊ້ງານ UTB OpenDict ຫຼື ການແປ EN-VI-LO ໄດ້.`,
      };

      const answer =
        fallbackByLanguage[normalizedLanguage] || fallbackByLanguage.vi;
      return {
        success: true,
        data: {
          answer,
          format: "text",
          scopeStatus: "allowed",
          relatedTerms,
          suggestions: [],
          provider: "demo",
          model: "fallback",
          timestamp: new Date(),
        },
      };
    }

    // Check daily API limits before calling provider
    const usageCheck = await trackAPIUsage(0);
    if (usageCheck.limitReached) {
      return {
        success: true,
        data: {
          answer: getScopeRefusalMessage(normalizedLanguage),
          format: "text",
          scopeStatus: "allowed",
          relatedTerms,
          suggestions: [],
          provider: "limit-guard",
          model: "rule-based",
          timestamp: new Date(),
        },
      };
    }

    const prompt = buildAssistantPrompt({
      query: trimmedQuery,
      language: normalizedLanguage,
      context,
    });

    const aiRawResponse = await callAiProvider(prompt, config, {
      responseMode: "text",
    });

    const estimatedTokens = Math.ceil(
      (prompt.length + (aiRawResponse?.length || 0)) / 4,
    );
    await trackAPIUsage(estimatedTokens);

    const answer = stripMarkdownFence(aiRawResponse);

    return {
      success: true,
      data: {
        answer,
        format: inferResponseFormat(answer),
        scopeStatus: "allowed",
        relatedTerms,
        suggestions: [],
        provider: config.provider,
        model: config.model,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error("AI Agent Chat Error:", error.message);

    const normalizedLanguage = normalizeLanguage(language);
    return {
      success: true,
      data: {
        answer: getScopeRefusalMessage(normalizedLanguage),
        format: "text",
        scopeStatus: "allowed",
        relatedTerms: [],
        suggestions: [],
        provider: "fallback",
        model: "rule-based",
        timestamp: new Date(),
      },
    };
  }
};

/**
 * Lấy lịch sử chat AI của user
 */
const getChatHistory = async (userId, limit = 10) => {
  return {
    success: true,
    data: {
      history: [],
      message: "Chat history feature will be implemented soon",
    },
  };
};

/**
 * Lấy trạng thái cấu hình AI
 */
const getStatus = async () => {
  const config = await getAIConfig();

  return {
    available: true,
    configured: !!config.apiKey,
    provider: config.provider,
    model: config.model,
    message: config.apiKey
      ? `Dịch vụ AI (${config.provider}) đã được cấu hình và sẵn sàng`
      : "Dịch vụ AI đang chạy ở chế độ demo. Admin cần cấu hình API key để sử dụng AI thực.",
  };
};

/**
 * Cập nhật cấu hình AI (chỉ Admin)
 */
const updateConfig = async (configData, userId) => {
  try {
    const updates = [];

    if (configData.apiKey !== undefined) {
      await SystemConfig.setValue("ai_api_key", configData.apiKey, userId);
      updates.push("API Key");
    }

    if (configData.provider !== undefined) {
      await SystemConfig.setValue("ai_provider", configData.provider, userId);
      updates.push("Provider");
    }

    if (configData.model !== undefined) {
      await SystemConfig.setValue("ai_model", configData.model, userId);
      updates.push("Model");
    }

    if (configData.temperature !== undefined) {
      await SystemConfig.setValue(
        "ai_temperature",
        configData.temperature,
        userId,
      );
      updates.push("Temperature");
    }

    if (configData.maxTokens !== undefined) {
      await SystemConfig.setValue(
        "ai_max_tokens",
        configData.maxTokens,
        userId,
      );
      updates.push("Max Tokens");
    }

    if (configData.promptDefinition !== undefined) {
      await SystemConfig.setValue(
        "ai_prompt_definition",
        configData.promptDefinition,
        userId,
      );
      updates.push("Prompt Definition");
    }

    if (configData.promptExplanation !== undefined) {
      await SystemConfig.setValue(
        "ai_prompt_explanation",
        configData.promptExplanation,
        userId,
      );
      updates.push("Prompt Explanation");
    }

    if (configData.promptAnswer !== undefined) {
      await SystemConfig.setValue(
        "ai_prompt_answer",
        configData.promptAnswer,
        userId,
      );
      updates.push("Prompt Answer");
    }

    return {
      success: true,
      message: `Đã cập nhật: ${updates.join(", ")}`,
      config: await getAIConfig(),
    };
  } catch (error) {
    console.error("Update AI Config Error:", error);
    throw error;
  }
};

/**
 * Test kết nối AI với một prompt mẫu
 */
const testConnection = async () => {
  try {
    const testTerm = "Machine Learning";
    const result = await askAboutTerm(testTerm, "vi", null);

    return {
      success: result.success,
      configured: result.data.provider !== "demo",
      provider: result.data.provider,
      model: result.data.model,
      message: result.success
        ? "Kết nối AI thành công"
        : "Không thể kết nối với dịch vụ AI",
    };
  } catch (error) {
    return {
      success: false,
      configured: false,
      message: "Lỗi khi test kết nối: " + error.message,
    };
  }
};

/**
 *
 * Xác định và phân loại các thuật ngữ tiềm năng từ một truy vấn người dùng, trả về danh sách các thuật ngữ với tên, lĩnh vực, độ tin cậy, và gợi ý dịch sang các ngôn ngữ khác
 */
const identifyAndClassifyTerms = async ({
  query,
  language = "vi",
  context = {},
}) => {
  try {
    const normalizedLanguage = normalizeLanguage(language);
    const config = await getAIConfig();

    if (!query || String(query).trim().length === 0) {
      return {
        success: false,
        message: "Thuật ngữ là bắt buộc",
        terms: [],
      };
    }

    // Create a structured prompt for term identification and classification
    const termIdentificationPrompt = `
You are a multilingual terminology expert for OpenDict - an open-source dictionary system.

User Input: "${query.trim()}"
Current Language: ${normalizedLanguage === "vi" ? "Vietnamese (VI)" : normalizedLanguage === "en" ? "English (EN)" : "Lao (LO)"}

Task: Identify all potential terminology terms in the user's input and classify them.

Requirements:
1. Extract all noun phrases, technical terms, domain-specific words that could be dictionary entries
2. For each term, provide:
   - The term name in the source language
   - The detected field/domain (e.g., "Computer Science", "Medicine", "Business", "General")
   - Confidence level (0-1) for whether it's a dictionary entry
   - Suggested translations to other major languages

Format your response ONLY as a valid JSON array with this structure:
[
  {
    "term": "term name",
    "language": "${normalizedLanguage}",
    "domain": "field/domain",
    "confidence": 0.85,
    "translations": {
      "vi": "Vietnamese translation",
      "en": "English translation",
      "lo": "Lao translation"
    }
  }
]

Return ONLY the JSON array, no markdown wrappers or extra text. If you detect no clear terms, return an empty array [].
`;

    const aiResponse = await callAiProvider(termIdentificationPrompt, config, {
      responseMode: "json",
    });

    let parsedTerms = [];

    try {
      const cleaned = aiResponse
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      parsedTerms = JSON.parse(cleaned);

      if (!Array.isArray(parsedTerms)) {
        parsedTerms = [];
      }
    } catch (parseErr) {
      console.warn("Term identification JSON parse error:", parseErr);
      parsedTerms = [];
    }

    // Estimate tokens and track usage
    const estimatedTokens = Math.ceil(
      (termIdentificationPrompt.length + aiResponse.length) / 4,
    );
    await trackAPIUsage(estimatedTokens);

    return {
      success: true,
      terms: parsedTerms,
      message: `Identified ${parsedTerms.length} potential term(s)`,
    };
  } catch (error) {
    console.error("Identify and Classify Terms Error:", error);
    return {
      success: false,
      message: error.message,
      terms: [],
    };
  }
};

const translateTermName = async ({
  termName,
  sourceLanguage = "en",
  targetLanguages = ["vi", "en", "lo"],
  domain = "General",
}) => {
  try {
    const config = await getAIConfig();

    if (!termName || String(termName).trim().length === 0) {
      return {
        success: false,
        message: "Tên thuật ngữ là bắt buộc",
        translations: {},
      };
    }

    const normalizedSource = normalizeLanguage(sourceLanguage);
    const langNames = {
      vi: "Vietnamese",
      en: "English",
      lo: "Lao",
    };

    const translationPrompt = `
You are a terminology translation expert for UTB OpenDict dictionary system.

Term to Translate: "${termName.trim()}"
Source Language: ${langNames[normalizedSource] || "English"}
Domain/Field: ${domain}
Target Languages: ${targetLanguages
      .filter((l) => normalizeLanguage(l) !== normalizedSource)
      .map(
        (l) => `${langNames[normalizeLanguage(l)]} (${normalizeLanguage(l)})`,
      )
      .join(", ")}

Provide accurate translations maintaining terminology consistency. Consider:
1. Technical precision in the field/domain
2. Natural phrasing in each target language
3. Common usage in open-source/academic contexts

Format your response ONLY as valid JSON with this structure:
{
  "original": "${termName.trim()}",
  "sourceLanguage": "${normalizedSource}",
  "domain": "${domain}",
  "translations": {
    "vi": "Vietnamese translation",
    "en": "English translation",
    "lo": "Lao translation"
  },
  "notes": "Any special translation notes or field-specific terminology"
}

Return ONLY JSON, no markdown wrappers.
`;

    const aiResponse = await callAiProvider(translationPrompt, config, {
      responseMode: "json",
    });

    let translationResult = {
      original: termName,
      translations: {},
      notes: "",
    };

    try {
      const cleaned = aiResponse
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      translationResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Translation JSON parse error:", parseErr);
      translationResult = {
        original: termName,
        translations: { [normalizedSource]: termName },
        notes: "Translation service encountered an error",
      };
    }

    // Track API usage
    const estimatedTokens = Math.ceil(
      (translationPrompt.length + aiResponse.length) / 4,
    );
    await trackAPIUsage(estimatedTokens);

    return {
      success: true,
      data: translationResult,
      message: "Dịch thuật đã hoàn thành",
    };
  } catch (error) {
    console.error("Translate Term Name Error:", error);
    return {
      success: false,
      message: error.message,
      data: { original: termName, translations: {}, notes: "Error occurred" },
    };
  }
};

const getTermTaxonomy = async ({ termName, language = "vi", context = {} }) => {
  try {
    const normalizedLanguage = normalizeLanguage(language);
    const config = await getAIConfig();

    if (!termName || String(termName).trim().length === 0) {
      return {
        success: false,
        message: "Tên thuật ngữ là bắt buộc",
        taxonomy: {},
      };
    }

    const taxonomyPrompt = `
You are a terminology classification expert for UTB OpenDict dictionary system.

Term: "${termName.trim()}"
Language: ${normalizedLanguage === "vi" ? "Vietnamese (VI)" : normalizedLanguage === "en" ? "English (EN)" : "Lao (LO)"}

Classify this term by determining:
1. Primary field/domain (e.g., "Computer Science", "Medicine", "Business", "Law", "General")
2. Sub-categories within that field
3. Related keywords/tags
4. Difficulty level (beginner/intermediate/advanced)
5. Related term suggestions

Format ONLY as valid JSON:
{
  "term": "${termName.trim()}",
  "language": "${normalizedLanguage}",
  "primaryField": "Field name",
  "subCategories": ["Category 1", "Category 2"],
  "keywords": ["keyword1", "keyword2"],
  "difficultyLevel": "intermediate",
  "suggestedRelatedTerms": ["related1", "related2"],
  "abbreviationIfAny": "Acronym or abbreviation if applicable"
}

Return ONLY JSON, no markdown.
`;

    const aiResponse = await callAiProvider(taxonomyPrompt, config, {
      responseMode: "json",
    });

    let taxonomy = {
      term: termName,
      primaryField: "General",
      subCategories: [],
      keywords: [],
      difficultyLevel: "intermediate",
      suggestedRelatedTerms: [],
    };

    try {
      const cleaned = aiResponse
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      taxonomy = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Taxonomy JSON parse error:", parseErr);
    }

    // Track API usage
    const estimatedTokens = Math.ceil(
      (taxonomyPrompt.length + aiResponse.length) / 4,
    );
    await trackAPIUsage(estimatedTokens);

    return {
      success: true,
      data: taxonomy,
      message: "Taxonomy cho thuật ngữ đã được xác định",
    };
  } catch (error) {
    console.error("Get Term Taxonomy Error:", error);
    return {
      success: false,
      message: error.message,
      data: {
        term: termName,
        primaryField: "Unknown",
        subCategories: [],
        keywords: [],
      },
    };
  }
};

module.exports = {
  getAIConfig,
  askAboutTerm,
  askAgentChat,
  identifyAndClassifyTerms,
  translateTermName,
  getTermTaxonomy,
  getChatHistory,
  getStatus,
  updateConfig,
  testConnection,
  getAPIUsageStats,
};
