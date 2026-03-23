const aiService = require("../services/aiService");
const termService = require("../services/termService");
const categoryService = require("../services/categoryService");
const contributionService = require("../services/contributionService");
const reputationService = require("../services/reputationService");
const { successResponse, errorResponse } = require("../utils/response");
const { REPUTATION } = require("../utils/constants");

/**
 * Chat với AI Agent (natural response + context-aware + scope guard)
 * POST /api/ai/agent/chat
 */
const chatWithAgent = async (req, res) => {
  try {
    const { query, language = "vi", context = {} } = req.body;
    const userId = req.user?.id;

    if (!query || String(query).trim().length === 0) {
      return errorResponse(res, "Query is required", 400);
    }

    const result = await aiService.askAgentChat({
      query: String(query).trim(),
      language,
      context,
      userId,
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || "Failed to process request",
        400,
      );
    }

    return successResponse(
      res,
      "Agent response generated successfully",
      result.data,
    );
  } catch (error) {
    console.error("AI Agent Chat Controller Error:", error);
    return errorResponse(res, "Error processing AI agent chat", 500);
  }
};

/**
 * Lấy đề xuất hành động tiếp theo dựa trên context
 * POST /api/ai/agent/suggestions
 */
const getSuggestions = async (req, res) => {
  try {
    const { context, maxSuggestions = 3 } = req.body;
    const userId = req.user?.id;

    if (!context) {
      return errorResponse(res, "Context is required", 400);
    }

    const suggestions = [];
    const {
      currentPage,
      searchQuery,
      selectedTerm,
      userReputationLevel,
      contributedTerms,
      language = "vi",
    } = context;

    // Nếu đang ở trang tìm kiếm mà không có kết quả
    if (currentPage === "search" && searchQuery) {
      const searchResult = await termService.searchTerms(searchQuery, {
        limit: 1,
        language,
      });
      const terms = searchResult?.terms || [];

      if (terms.length === 0) {
        // Đề xuất: Hỏi AI về từ không có
        suggestions.push({
          id: `suggest-ask-ai-${Date.now()}`,
          type: "learn",
          title: "Hỏi AI về thuật ngữ",
          description: `Hỏi AI để tìm hiểu thêm về "${searchQuery}"`,
          icon: "Bot",
          action: {
            type: "ask_ai",
            params: { term: searchQuery, language },
          },
          priority: 3,
        });

        // Đề xuất: Đóng góp thuật ngữ
        if (userId) {
          suggestions.push({
            id: `suggest-contribute-${Date.now()}`,
            type: "contribute",
            title: "Đóng góp thuật ngữ mới",
            description: `Bạn có thể đóng góp định nghĩa cho "${searchQuery}"`,
            icon: "FileText",
            action: {
              type: "suggest_term",
              params: { term: searchQuery },
            },
            priority: 2,
          });
        }
      } else {
        // Có kết quả - đề xuất khám phá thêm
        suggestions.push({
          id: `suggest-related-${Date.now()}`,
          type: "explore",
          title: "Khám phá danh mục liên quan",
          description: "Tìm hiểu thêm về các danh mục liên quan",
          icon: "Lightbulb",
          action: {
            type: "explore_category",
            params: {
              categoryId: terms[0]?.category?._id || terms[0]?.category,
            },
          },
          priority: 1,
        });
      }
    }

    // Nếu có thuật ngữ được chọn - đề xuất hành động tiếp theo
    if (selectedTerm && selectedTerm.id) {
      // Đề xuất: Thêm vào danh sách yêu thích
      suggestions.push({
        id: `suggest-favorite-${Date.now()}`,
        type: "navigate",
        title: "Thêm vào danh sách yêu thích",
        description: "Lưu thuật ngữ này để truy cập sau",
        icon: "Star",
        action: {
          type: "view_term",
          params: { termId: selectedTerm.id },
        },
        priority: 1,
      });

      // Đề xuất: Bình luận
      if (userId) {
        suggestions.push({
          id: `suggest-comment-${Date.now()}`,
          type: "navigate",
          title: "Bình luận về thuật ngữ",
          description: "Chia sẻ ý kiến của bạn",
          icon: "MessageSquare",
          action: {
            type: "view_term",
            params: { termId: selectedTerm.id },
          },
          priority: 1,
        });
      }
    }

    // Đề xuất dựa trên mức uy tín
    if (userId && userReputationLevel !== undefined) {
      const remainingPoints =
        REPUTATION.LEVELS[3]?.min - (userReputationLevel || 0);

      if (remainingPoints > 0 && remainingPoints <= 100) {
        suggestions.push({
          id: `suggest-reputation-${Date.now()}`,
          type: "learn",
          title: "Hãy tăng uy tín của bạn",
          description: `Chỉ cần ${remainingPoints} điểm nữa để đạt cấp độ cao hơn`,
          icon: "TrendingUp",
          action: {
            type: "redirect",
            target: "/profile/reputation",
          },
          priority: 1,
        });
      }
    }

    // Đề xuất dựa trên hoạt động của người dùng
    if (userId) {
      if (!contributedTerms || contributedTerms === 0) {
        suggestions.push({
          id: `suggest-first-contribution-${Date.now()}`,
          type: "contribute",
          title: "Thực hiện đóng góp đầu tiên",
          description: "Hãy đóng góp thuật ngữ đầu tiên của bạn",
          icon: "Rocket",
          action: {
            type: "redirect",
            target: "/contribute",
          },
          priority: 2,
        });
      }
    }

    // Sắp xếp theo priority giảm dần, lấy maxSuggestions
    const sortedSuggestions = suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxSuggestions);

    return successResponse(res, "Suggestions retrieved successfully", {
      suggestions: sortedSuggestions,
    });
  } catch (error) {
    console.error("Get Suggestions Error:", error);
    return errorResponse(res, "Error getting suggestions", 500);
  }
};

/**
 * Lấy đề xuất hành động tiếp theo sau khi tìm kiếm
 * POST /api/ai/agent/search-suggestions
 */
const getSearchSuggestions = async (req, res) => {
  try {
    const { query, resultsCount = 0, language = "vi" } = req.body;
    const suggestions = [];

    if (!query) {
      return errorResponse(res, "Query is required", 400);
    }

    if (resultsCount === 0) {
      // Không có kết quả - gợi ý hỏi AI
      suggestions.push({
        id: `search-ask-ai-${Date.now()}`,
        type: "learn",
        title: "Hỏi AI về từ này",
        description: `Tìm hiểu thêm về "${query}" từ AI`,
        icon: "Bot",
        action: {
          type: "ask_ai",
          params: { term: query, language },
        },
        priority: 3,
      });

      // Gợi ý đóng góp
      suggestions.push({
        id: `search-contribute-${Date.now()}`,
        type: "contribute",
        title: "Đóng góp định nghĩa",
        description: `Bạn có biết định nghĩa của "${query}"?`,
        icon: "FileText",
        action: {
          type: "suggest_term",
          params: { term: query },
        },
        priority: 2,
      });
    } else if (resultsCount < 5) {
      // Ít kết quả - gợi ý tìm kiếm liên quan
      suggestions.push({
        id: `search-similar-${Date.now()}`,
        type: "search",
        title: "Tìm từ tương tự",
        description: "Hãy thử tìm từ khác liên quan",
        icon: "Search",
        action: {
          type: "redirect",
          target: "/search",
        },
        priority: 1,
      });
    } else {
      // Có nhiều kết quả - gợi ý lọc
      suggestions.push({
        id: `search-explore-${Date.now()}`,
        type: "explore",
        title: "Khám phá danh mục",
        description: "Duyệt các danh mục để tìm hiểu thêm",
        icon: "Lightbulb",
        action: {
          type: "redirect",
          target: "/categories",
        },
        priority: 1,
      });
    }

    return successResponse(res, "Search suggestions retrieved successfully", {
      suggestions,
    });
  } catch (error) {
    console.error("Get Search Suggestions Error:", error);
    return errorResponse(res, "Error getting search suggestions", 500);
  }
};

/**
 * Lấy danh sách thuật ngữ liên quan
 * GET /api/ai/agent/related-terms/:termId
 */
const getRelatedTerms = async (req, res) => {
  try {
    const { termId } = req.params;
    const { language = "vi" } = req.query;

    const term = await termService.getTermById(termId);
    if (!term) {
      return errorResponse(res, "Term not found", 404);
    }

    // Tìm các thuật ngữ liên quan
    let relatedTerms = [];
    if (term.relatedTerms && term.relatedTerms.length > 0) {
      relatedTerms = term.relatedTerms.filter(Boolean);
    }

    // Nếu không có relatedTerms, tìm thuật ngữ trong cùng danh mục
    if (relatedTerms.length === 0 && term.category) {
      const categoryTermsResult = await termService.searchTerms("", {
        category: term.category,
        limit: 5,
        language,
      });
      relatedTerms = (categoryTermsResult?.terms || []).filter(
        (t) => t && String(t._id) !== String(termId),
      );
    }

    return successResponse(res, "Related terms retrieved successfully", {
      terms: relatedTerms.slice(0, 5),
    });
  } catch (error) {
    console.error("Get Related Terms Error:", error);
    return errorResponse(res, "Error getting related terms", 500);
  }
};

/**
 * Lấy danh mục được đề xuất
 * GET /api/ai/agent/suggested-categories
 */
const getSuggestedCategories = async (req, res) => {
  try {
    const { language = "vi", limit = 5 } = req.query;

    const categories = await categoryService.getAll({
      limit: parseInt(limit),
    });

    return successResponse(res, "Categories retrieved successfully", {
      categories,
    });
  } catch (error) {
    console.error("Get Suggested Categories Error:", error);
    return errorResponse(res, "Error getting suggested categories", 500);
  }
};

/**
 * Nhận feedback từ người dùng về đề xuất
 * POST /api/ai/agent/feedback
 */
const provideFeedback = async (req, res) => {
  try {
    const { suggestionId, userAction } = req.body;
    const userId = req.user?.id;

    if (!suggestionId || !userAction) {
      return errorResponse(
        res,
        "suggestionId and userAction are required",
        400,
      );
    }

    // Log feedback for AI improvement (có thể lưu vào DB sau)
    console.log(
      `[AI Feedback] User: ${userId}, Action: ${userAction}, Suggestion: ${suggestionId}`,
    );

    return successResponse(res, "Feedback received successfully", {
      message: "Feedback received",
    });
  } catch (error) {
    console.error("Provide Feedback Error:", error);
    return errorResponse(res, "Error providing feedback", 500);
  }
};

/**
 * Lấy hành động ngữ cảnh dựa trên trang hiện tại
 * POST /api/ai/agent/contextual-actions
 */
const getContextualActions = async (req, res) => {
  try {
    const { context } = req.body;
    const userId = req.user?.id;

    if (!context) {
      return errorResponse(res, "Context is required", 400);
    }

    const actions = [];
    const { currentPage, language = "vi" } = context;

    // Hành động dựa trên trang hiện tại
    switch (currentPage) {
      case "home":
        actions.push({
          id: `action-search-${Date.now()}`,
          type: "search",
          title: "Tìm kiếm thuật ngữ",
          description: "Tìm kiếm trong từ điển",
          icon: "Search",
          action: { type: "redirect", target: "/search" },
          priority: 1,
        });
        if (userId) {
          actions.push({
            id: `action-contribute-${Date.now()}`,
            type: "contribute",
            title: "Đóng góp thuật ngữ",
            description: "Giúp cộng đồng bằng cách đóng góp",
            icon: "FileText",
            action: { type: "redirect", target: "/contribute" },
            priority: 1,
          });
        }
        break;

      case "contribute":
        actions.push({
          id: `action-preview-${Date.now()}`,
          type: "read",
          title: "Xem trước đóng góp",
          description: "Kiểm tra lại thông tin trước khi gửi",
          icon: "Eye",
          action: { type: "redirect", target: "#" },
          priority: 1,
        });
        break;

      case "terms":
        if (userId) {
          actions.push({
            id: `action-favorite-${Date.now()}`,
            type: "navigate",
            title: "Xem thuật ngữ yêu thích",
            description: "Xem các thuật ngữ bạn đã lưu",
            icon: "Star",
            action: { type: "redirect", target: "/favorites" },
            priority: 1,
          });
        }
        break;
    }

    return successResponse(res, "Contextual actions retrieved successfully", {
      actions,
    });
  } catch (error) {
    console.error("Get Contextual Actions Error:", error);
    return errorResponse(res, "Error getting contextual actions", 500);
  }
};

/**
 * Gợi ý từ khóa tìm kiếm
 * POST /api/ai/agent/search-keywords
 */
const suggestSearchKeywords = async (req, res) => {
  try {
    const { currentQuery = "", language = "vi" } = req.body;

    // Tìm các thuật ngữ có tiền tố match
    const keywords = await termService.getSearchSuggestions(currentQuery, {
      limit: 5,
      language,
    });

    return successResponse(res, "Keywords retrieved successfully", {
      keywords: keywords || [],
    });
  } catch (error) {
    console.error("Suggest Search Keywords Error:", error);
    return errorResponse(res, "Error suggesting keywords", 500);
  }
};

/**
 * Nhận AI recommendation về việc nên đóng góp thuật ngữ hay không
 * POST /api/ai/agent/contribution-recommendation
 */
const getContributionRecommendation = async (req, res) => {
  try {
    const { term, definition, language = "vi" } = req.body;
    const userId = req.user?.id;

    if (!term || !definition) {
      return errorResponse(res, "term and definition are required", 400);
    }

    // Kiểm tra xem thuật ngữ đã tồn tại hay chưa
    const searchResult = await termService.searchTerms(term, {
      limit: 5,
      language,
      sortBy: "relevance",
    });
    const existingTerm = (searchResult?.terms || []).filter((item) => {
      const values = [item?.term?.vi, item?.term?.en, item?.term?.lo]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return values.includes(String(term).trim().toLowerCase());
    });

    let recommendation = {
      recommended: true,
      reason: "Thuật ngữ tốt và sẵn sàng được đóng góp",
      suggestions: [],
    };

    if (existingTerm && existingTerm.length > 0) {
      recommendation = {
        recommended: false,
        reason: "Thuật ngữ này đã tồn tại trong từ điển",
        suggestions: [
          "Bạn có thể sửa đổi định nghĩa hiện có thay vì tạo mới",
          "Kiểm tra xem định nghĩa của bạn có khác biệt không",
        ],
      };
    } else if (definition.length < 20) {
      recommendation.suggestions.push("Định nghĩa của bạn có thể quá ngắn");
    }

    if (definition.length > 1000) {
      recommendation.suggestions.push(
        "Định nghĩa của bạn có thể quá dài, hãy rút ngắn",
      );
    }

    return successResponse(
      res,
      "Recommendation retrieved successfully",
      recommendation,
    );
  } catch (error) {
    console.error("Get Contribution Recommendation Error:", error);
    return errorResponse(res, "Error getting recommendation", 500);
  }
};

/**
 * Identify and classify terms in user input
 * POST /api/ai/agent/identify-terms
 */
const identifyTerms = async (req, res) => {
  try {
    const { query, language = "vi", context = {} } = req.body;
    const userId = req.user?.id;

    if (!query || String(query).trim().length === 0) {
      return errorResponse(res, "Query is required", 400);
    }

    const result = await aiService.identifyAndClassifyTerms({
      query: String(query).trim(),
      language,
      context,
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || "Failed to identify terms",
        400,
      );
    }

    return successResponse(
      res,
      "Terms identified and classified successfully",
      {
        terms: result.terms,
        count: result.terms?.length || 0,
      },
    );
  } catch (error) {
    console.error("Identify Terms Controller Error:", error);
    return errorResponse(res, "Error identifying terms", 500);
  }
};

/**
 * Translate a term name across languages
 * POST /api/ai/agent/translate-term
 */
const translateTerm = async (req, res) => {
  try {
    const {
      termName,
      sourceLanguage = "en",
      targetLanguages,
      domain,
    } = req.body;
    const userId = req.user?.id;

    if (!termName || String(termName).trim().length === 0) {
      return errorResponse(res, "Term name is required", 400);
    }

    const result = await aiService.translateTermName({
      termName: String(termName).trim(),
      sourceLanguage,
      targetLanguages: targetLanguages || ["vi", "en", "lo"],
      domain: domain || "General",
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || "Failed to translate term",
        400,
      );
    }

    return successResponse(res, "Term translated successfully", result.data);
  } catch (error) {
    console.error("Translate Term Controller Error:", error);
    return errorResponse(res, "Error translating term", 500);
  }
};

/**
 * Get term taxonomy and classification
 * POST /api/ai/agent/term-taxonomy
 */
const getTermTaxonomy = async (req, res) => {
  try {
    const { termName, language = "vi", context = {} } = req.body;
    const userId = req.user?.id;

    if (!termName || String(termName).trim().length === 0) {
      return errorResponse(res, "Term name is required", 400);
    }

    const result = await aiService.getTermTaxonomy({
      termName: String(termName).trim(),
      language,
      context,
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.message || "Failed to get taxonomy",
        400,
      );
    }

    return successResponse(
      res,
      "Term taxonomy retrieved successfully",
      result.data,
    );
  } catch (error) {
    console.error("Get Term Taxonomy Controller Error:", error);
    return errorResponse(res, "Error getting term taxonomy", 500);
  }
};

module.exports = {
  chatWithAgent,
  getSuggestions,
  getSearchSuggestions,
  getRelatedTerms,
  getSuggestedCategories,
  provideFeedback,
  getContextualActions,
  suggestSearchKeywords,
  getContributionRecommendation,
  identifyTerms,
  translateTerm,
  getTermTaxonomy,
};
