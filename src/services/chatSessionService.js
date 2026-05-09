const CHAT_SESSION_TIMEOUT = 30 * 60 * 1000;
const MAX_SESSIONS = 1000;

let activeSessions = new Map();
let sessionCounter = 0;

/**
 * Tạo session chat mới
 */
const createSession = (userId, metadata = {}) => {
  const sessionId = `session_${Date.now()}_${++sessionCounter}`;

  const session = {
    id: sessionId,
    userId,
    createdAt: new Date(),
    lastActivity: new Date(),
    messages: [],
    context: {
      currentPage: metadata.currentPage || "home",
      lastTermSearched: null,
      lastFieldSearched: null,
      language: metadata.language || "vi",
      userRole: metadata.userRole || "user",
      ...metadata,
    },
    preferences: {
      responseStyle: "concise",
      includeExamples: true,
      includeRelatedTerms: true,
    },
  };

  activeSessions.set(sessionId, session);

  // Cleanup old sessions nếu exceed limit
  if (activeSessions.size > MAX_SESSIONS) {
    const oldestSession = Array.from(activeSessions.values()).sort(
      (a, b) => a.lastActivity - b.lastActivity,
    )[0];
    activeSessions.delete(oldestSession.id);
  }

  return session;
};

/**
 * Lấy session theo ID
 */
const getSession = (sessionId) => {
  const session = activeSessions.get(sessionId);

  if (!session) return null;

  // Check timeout
  const ageMs = Date.now() - session.lastActivity.getTime();
  if (ageMs > CHAT_SESSION_TIMEOUT) {
    activeSessions.delete(sessionId);
    return null;
  }

  return session;
};

/**
 * Cập nhật activity của session
 */
const updateSessionActivity = (sessionId) => {
  const session = getSession(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
};

/**
 * Thêm message vào session history
 */
const addMessageToSession = (sessionId, message) => {
  const session = getSession(sessionId);
  if (!session) return null;

  session.messages.push({
    ...message,
    timestamp: new Date(),
  });

  // Keep only last 20 messages
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  updateSessionActivity(sessionId);
  return session;
};

/**
 * Cập nhật context của session
 */
const updateSessionContext = (sessionId, contextUpdate) => {
  const session = getSession(sessionId);
  if (!session) return null;

  session.context = {
    ...session.context,
    ...contextUpdate,
  };

  updateSessionActivity(sessionId);
  return session;
};

/**
 * Detect intent từ user message
 */
const detectIntent = (message, language = "vi") => {
  const normalized = message.toLowerCase().trim();

  // Define intent patterns
  const intentPatterns = {
    search: {
      keywords: ["tìm", "search", "find", "kiếm", "tra cứu", "lookup"],
      priority: 1,
    },
    definition: {
      keywords: [
        "định nghĩa",
        "định nghĩa là gì",
        "definition",
        "what is",
        "là gì",
        "ແມ່ນຫຍັງ",
      ],
      priority: 1,
    },
    contribution: {
      keywords: [
        "đóng góp",
        "contribute",
        "thêm",
        "add",
        "tạo",
        "sửa",
        "edit",
        "suggest",
      ],
      priority: 2,
    },
    translation: {
      keywords: ["dịch", "translate", "tiếng anh", "english", "lào", "lao"],
      priority: 1,
    },
    learning: {
      keywords: [
        "học",
        "học thêm",
        "giải thích",
        "explain",
        "ອະທິບາຍ",
        "chi tiết",
      ],
      priority: 2,
    },
    help: {
      keywords: ["giúp", "help", "hướng dẫn", "guide", "tutorial", "cách"],
      priority: 1,
    },
    feedback: {
      keywords: [
        "phản hồi",
        "feedback",
        "gợi ý",
        "suggest",
        "báo cáo",
        "report",
      ],
      priority: 3,
    },
  };

  const detectedIntents = [];

  for (const [intentName, intentData] of Object.entries(intentPatterns)) {
    for (const keyword of intentData.keywords) {
      if (normalized.includes(keyword)) {
        detectedIntents.push({
          intent: intentName,
          priority: intentData.priority,
          keyword,
        });
        break;
      }
    }
  }

  // Sort by priority and return top intent
  return detectedIntents.length > 0
    ? detectedIntents.sort((a, b) => a.priority - b.priority)[0].intent
    : "general";
};

/**
 * Extract entities từ message (term names, fields, etc.)
 */
const extractEntities = (message, session = {}) => {
  const entities = {
    termNames: [],
    fields: [],
    languages: [],
    actionType: null,
  };

  // Extract language mentions
  if (message.match(/tiếng anh|english|en/i)) {
    entities.languages.push("en");
  }
  if (message.match(/tiếng việt|vietnamese|vi/i)) {
    entities.languages.push("vi");
  }
  if (message.match(/lào|lao|lo/i)) {
    entities.languages.push("lo");
  }

  // Extract quoted terms
  const quotedMatches = message.match(/"([^"]+)"/g);
  if (quotedMatches) {
    entities.termNames = quotedMatches.map((m) => m.replace(/"/g, "").trim());
  }

  // Try to extract first noun phrase as term (simple heuristic)
  if (entities.termNames.length === 0) {
    const words = message.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      entities.termNames.push(words[0]);
    }
  }

  return entities;
};

/**
 * Determine response style dựa trên user preference và context
 */
const determineResponseStyle = (session, intent) => {
  const baseStyle = session?.preferences?.responseStyle || "concise";

  if (intent === "learning" || intent === "definition") {
    return baseStyle === "detailed" ? "detailed" : "detailed"; // Force detailed cho definition
  }

  if (intent === "feedback") {
    return "concise"; // Keep feedback collection short
  }

  return baseStyle;
};

/**
 * Build response hints dựa trên session context
 */
const buildResponseHints = (session, intent) => {
  const hints = [];

  // Suggest follow-up actions based on intent
  if (intent === "search") {
    hints.push({
      type: "suggestion",
      text:
        session?.context?.language === "vi"
          ? "Bạn có muốn xem định nghĩa chi tiết?"
          : "Would you like a detailed explanation?",
    });
  }

  if (intent === "definition") {
    if (session?.preferences?.includeExamples) {
      hints.push({
        type: "info",
        text:
          session?.context?.language === "vi"
            ? "Hệ thống sẽ cung cấp ví dụ sử dụng"
            : "Examples will be provided",
      });
    }
  }

  if (intent === "contribution") {
    hints.push({
      type: "action",
      text:
        session?.context?.language === "vi"
          ? "Truy cập trang đóng góp để thêm thuật ngữ mới"
          : "Go to contribution page to add new terms",
    });
  }

  return hints;
};

/**
 * Get conversation summary từ session history
 */
const getConversationSummary = (sessionId, lastN = 5) => {
  const session = getSession(sessionId);
  if (!session) return null;

  const recentMessages = session.messages.slice(-lastN);
  const summary = {
    totalMessages: session.messages.length,
    recentMessages,
    mainIntents: [],
    searchedTerms: [],
    context: session.context,
  };

  // Extract common intents và terms
  const allIntents = recentMessages
    .filter((m) => m.role === "user")
    .map((m) => detectIntent(m.content, session.context.language));

  summary.mainIntents = [...new Set(allIntents)]; // Unique intents

  // Collect searched terms từ messages
  recentMessages.forEach((m) => {
    if (m.role === "user") {
      const entities = extractEntities(m.content, session);
      summary.searchedTerms.push(...entities.termNames);
    }
  });

  return summary;
};

/**
 * Clear inactive sessions
 */
const cleanupInactiveSessions = () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of activeSessions.entries()) {
    const ageMs = now - session.lastActivity.getTime();
    if (ageMs > CHAT_SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} inactive chat sessions`);
  }

  return cleanedCount;
};

// Run cleanup every 15 minutes
setInterval(cleanupInactiveSessions, 15 * 60 * 1000);

module.exports = {
  createSession,
  getSession,
  addMessageToSession,
  updateSessionContext,
  updateSessionActivity,
  detectIntent,
  extractEntities,
  determineResponseStyle,
  buildResponseHints,
  getConversationSummary,
  cleanupInactiveSessions,
};
