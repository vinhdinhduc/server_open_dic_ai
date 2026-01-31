module.exports = {
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

  REPORT_STATUS: {
    PENDING: "pending",
    RESOLVED: "resolved",
    REJECTED: "rejected",
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
