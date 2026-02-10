const { GoogleGenAI } = require("@google/genai");
const SystemConfig = require("../models/SystemConfig");

/**
 * Lấy cấu
 * hình AI từ database
 */
const getAIConfig = async () => {
  const apiKey = await SystemConfig.getValue("ai_api_key", "");
  const provider = await SystemConfig.getValue("ai_provider", "gemini");
  const model = await SystemConfig.getValue("ai_model", "gemini-2.5-flash");
  const temperature = await SystemConfig.getValue("ai_temperature", 0.7);
  const maxTokens = await SystemConfig.getValue("ai_max_tokens", 8192);

  return {
    apiKey,
    provider,
    model,
    temperature,
    maxTokens,
  };
};

/**
 * Hỏi AI về thuật ngữ không tìm thấy trong hệ thống
 * @param {string} term - Thuật ngữ cần tìm hiểu
 * @param {string} language - Ngôn ngữ (vi, en, lo)
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object>} - Kết quả từ AI
 */
const askAboutTerm = async (term, language = "vi", userId) => {
  try {
    // Lấy cấu hình từ database
    const config = await getAIConfig();
    console.log("📝 AI Config:", {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      hasApiKey: !!config.apiKey,
    });

    // Nếu không có API key, trả về mock response
    if (!config.apiKey) {
      return getMockResponse(term, language);
    }

    // Tạo prompt dựa trên ngôn ngữ
    const prompt = generateFullPrompt(term, language);

    // Gọi API theo provider
    let aiResponse;
    if (config.provider === "gemini") {
      aiResponse = await callGeminiAPI(prompt, config);
    } else {
      // Fallback to mock
      return getMockResponse(term, language);
    }

    // Parse AI response thành cấu trúc khớp Term model
    const structuredData = parseAIResponse(aiResponse, term, language, config);
    console.log("✨ Parsed structure:", {
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

    // Fallback to mock response if API fails
    return getMockResponse(term, language);
  }
};

/**
 * Gọi Google Gemini API sử dụng SDK
 */
const callGeminiAPI = async (prompt, config) => {
  try {
    const genAI = new GoogleGenAI({ apiKey: config.apiKey });

    // Xử lý tên model nếu có hậu tố "-latest"
    let modelName = config.model;
    if (modelName.endsWith("-latest")) {
      modelName = modelName.replace("-latest", "");
    }

    console.log(`🤖 Calling Gemini API with model: ${modelName}`);
    console.log(
      `📊 Config: maxTokens=${config.maxTokens}, temp=${config.temperature}`,
    );

    // Prepare generation config
    const generationConfig = {
      temperature: config.temperature,
      maxOutputTokens: Math.max(config.maxTokens, 2048),
      responseMimeType: "application/json",
      responseSchema: {
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
      },
    };

    // Generate content using @google/genai API
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: generationConfig,
    });

    const text = result.text;

    console.log(`✅ Received response from Gemini (${text.length} chars)`);

    // Kiểm tra nếu response bị truncated
    if (text.length < 100 || !text.trim().endsWith("}")) {
      console.warn("⚠️ Response seems truncated or incomplete");
      console.warn("Response preview:", text.substring(0, 200));
    }

    return text;
  } catch (error) {
    console.error("❌ Gemini SDK Error:", error.message);
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
const generateFullPrompt = (term, language) => {
  const systemPrompt = getSystemPrompt(language);
  const userPrompt = generatePrompt(term, language);

  return `${systemPrompt}\n\n${userPrompt}`;
};

/**
 * Tạo system prompt cho AI — yêu cầu trả về JSON chuẩn cấu trúc Term model
 */
const getSystemPrompt = (language) => {
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
    vi: `Bạn là trợ lý AI chuyên về từ điển thuật ngữ chuyên ngành.
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

  return prompts[language] || prompts.vi;
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

    // Loại bỏ markdown code block nếu AI thêm vào
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Làm sạch JSON string trước khi parse
    // Thay thế các ký tự xuống dòng không hợp lệ trong string values
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
      "⚠️ Failed to parse AI JSON, falling back to raw text:",
      e.message,
    );
    console.warn("Raw AI Response:", aiResponse.substring(0, 500));

    // Fallback: trả về raw text nếu không parse được JSON
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
    // Nếu lỗi, thử làm sạch
    console.log("🔧 Attempting to clean JSON string...");

    // Không làm gì với JSON đã đúng format
    // Chỉ xử lý các trường hợp đặc biệt

    // 1. Fix unescaped newlines trong string values
    // Tìm các string value có newline và replace bằng \\n
    let cleaned = jsonStr;

    // 2. Fix unescaped quotes trong string values
    // (Phức tạp, tạm thời bỏ qua vì có thể gây lỗi khác)

    // 3. Thử parse lại
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (e2) {
      // Nếu vẫn lỗi, trả về nguyên bản
      console.warn("❌ Could not clean JSON, returning original");
      return jsonStr;
    }
  }
};

// Trả về mock response khi không có API key hoặc API lỗi

const getMockResponse = (term, language) => {
  const mockData = {
    vi: {
      definition: `"${term}" là một thuật ngữ chuyên ngành chưa có trong hệ thống từ điển.`,
      detailedExplanation: `Thuật ngữ **"${term}"** hiện chưa có trong cơ sở dữ liệu từ điển của chúng tôi.\n\nĐây có thể là thuật ngữ thuộc các lĩnh vực: Công nghệ thông tin, Y học, Kỹ thuật, Kinh tế, hoặc các ngành khác.\n\n**Gợi ý:**\n- Đóng góp định nghĩa nếu bạn biết về thuật ngữ này\n- Liên hệ với quản trị viên để bổ sung\n- Tìm kiếm trên các nguồn tài liệu chuyên ngành\n\n*Đây là phản hồi mẫu. Để sử dụng AI thực, Admin cần cấu hình API key trong phần Cài đặt hệ thống.*`,
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
 * Lấy lịch sử chat AI của user (có thể mở rộng sau)
 */
const getChatHistory = async (userId, limit = 10) => {
  // TODO: Implement chat history storage in database
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

module.exports = {
  askAboutTerm,
  getChatHistory,
  getStatus,
  updateConfig,
  testConnection,
};
