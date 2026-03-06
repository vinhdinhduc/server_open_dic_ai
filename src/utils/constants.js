module.exports = {
  APP_NAME: "OpenDict",

  TOKEN_EXPIRY: {
    EMAIL_VERIFICATION_MS: 24 * 60 * 60 * 1000, // 24 giờ
    PASSWORD_RESET_MS: 30 * 60 * 1000, // 30 phút
    REFRESH_TOKEN_MS: 30 * 24 * 60 * 60 * 1000, // 30 ngày
  },

  USER_ROLES: {
    ADMIN: "admin",
    MODERATOR: "moderator",
    USER: "user",
  },

  TERM_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  },
  COMMENT_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  },

  CONTRIBUTION_TYPES: {
    NEW_TERM: "new_term",
    EDIT_TERM: "edit_term",
    REPORT_ERROR: "report_error",
  },

  CONTRIBUTION_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  },

  // Report (Báo xấu) constants
  REPORT_TYPES: {
    TERM: "term",
    COMMENT: "comment",
  },

  REPORT_REASONS: {
    INCORRECT: "incorrect",
    SPAM: "spam",
    INAPPROPRIATE: "inappropriate",
    DUPLICATE: "duplicate",
    OTHER: "other",
  },
  REPORT_REASONS_LABELS: {
    incorrect: "Thuật ngữ không chính xác",
    spam: "Nội dung quảng cáo hoặc spam",
    inappropriate: "Nội dung không phù hợp",
    duplicate: "Trùng lặp với thuật ngữ khác",
    other: "Lý do khác",
  },

  REPORT_STATUS: {
    PENDING: "pending",
    RESOLVED: "resolved",
    REJECTED: "rejected",
  },

  NOTIFICATION_TYPES: {
    CONTRIBUTION_APPROVED: "contribution_approved",
    CONTRIBUTION_REJECTED: "contribution_rejected",
    CONTRIBUTION_NEW: "contribution_new",
    COMMENT_REPLY: "comment_reply",
    COMMENT_MODERATED: "comment_moderated",
    REPORT_RESOLVED: "report_resolved",
    REPORT_REJECTED: "report_rejected",
    REPORT_NEW: "report_new",
    SYSTEM: "system",
  },

  MODERATION_PERMISSIONS: {
    SUGGESTIONS: "suggestions",
    CONTRIBUTIONS: "contributions",
    COMMENTS: "comments",
    REPORTS: "reports",
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
  LANGUAGES: {
    EN: "en",
    VI: "vi",
    LO: "lo",
  },
};
