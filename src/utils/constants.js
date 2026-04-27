module.exports = {
  APP_NAME: "UTB OpenDict",

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

  // Hằng số cho báo xấu
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
    API_LIMIT_WARNING: "api_limit_warning",
    API_LIMIT_REACHED: "api_limit_reached",
    REPUTATION_MILESTONE: "reputation_milestone",
    REPUTATION_PENALTY: "reputation_penalty",
    REDEMPTION_REQUEST: "redemption_request",
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

  // Reputation Points System (ĐUT)
  REPUTATION: {
    // Trọng số công thức: ĐUT = (ĐĐG × 0.5) + (ĐBX × 0.3) + (ĐT × 0.2) − ĐP
    WEIGHTS: {
      CONTRIBUTION: 0.5,
      REPORT: 0.3,
      BONUS: 0.2,
    },
    // Giới hạn điểm/ngày
    DAILY_LIMITS: {
      CONTRIBUTION: 50,
      REPORT: 30,
    },
    // Mức uy tín
    LEVELS: {
      1: {
        min: 0,
        max: 99,
        name: "Người mới",
        aiQueries: 5,
        features: ["explanation"],
      },
      2: {
        min: 100,
        max: 299,
        name: "Thành viên tích cực",
        aiQueries: 15,
        features: ["explanation", "related_terms"],
      },
      3: {
        min: 300,
        max: 599,
        name: "Cộng tác viên",
        aiQueries: 30,
        features: ["explanation", "related_terms", "comparison"],
      },
      4: {
        min: 600,
        max: 999,
        name: "Chuyên gia",
        aiQueries: 50,
        features: [
          "explanation",
          "related_terms",
          "comparison",
          "deep_analysis",
        ],
      },
      5: {
        min: 1000,
        max: Infinity,
        name: "Đại sứ",
        aiQueries: 100,
        features: [
          "explanation",
          "related_terms",
          "comparison",
          "deep_analysis",
          "unlimited",
        ],
      },
    },
    // Điểm đóng góp
    CONTRIBUTION_POINTS: {
      TERM_SUBMITTED: 2,
      TERM_APPROVED: 15,
      TERM_REJECTED_VALID: 0,
      TERM_REJECTED_SPAM: -3,
      EDIT_SUBMITTED: 1,
      EDIT_APPROVED: 10,
      EDIT_REJECTED_VALID: 0,
      EDIT_REJECTED_SABOTAGE: -3,
      EDIT_DUPLICATE: -1,
      EDIT_TARGET_COMPENSATION: 2,
      TERM_VIEW_MILESTONE: 3, // mỗi 100 lượt xem
      TERM_FAVORITE_MILESTONE: 5, // mỗi 10 favorites
      TERM_MONTHLY_USAGE: 10, // top sử dụng tháng
    },
    // Điểm báo xấu
    REPORT_POINTS: {
      APPROVED_INCORRECT: 10,
      APPROVED_SPAM: 8,
      APPROVED_INAPPROPRIATE: 15,
      APPROVED_DUPLICATE: 6,
      APPROVED_OTHER: 8,
      REJECTED_INCORRECT: -3,
      REJECTED_SPAM: -2,
      REJECTED_INAPPROPRIATE: -5,
      REJECTED_DUPLICATE: -2,
      REJECTED_OTHER: -3,
    },
    // Hệ số chính xác báo xấu
    REPORT_ACCURACY: {
      DEGRADE_THRESHOLD: 3, // ≥3 lần sai → áp dụng hệ số
      DEGRADE_MULTIPLIER: 0.5,
    },
    // Streak bonus
    STREAK: {
      DAYS_7_MULTIPLIER: 1.2,
      DAYS_30_MULTIPLIER: 1.5,
    },
    // Inactivity decay
    DECAY: {
      INACTIVE_DAYS: 30, // bắt đầu trừ sau 30 ngày
      DAILY_PENALTY: -2,
      MAX_PENALTY: -60,
    },
    // Đổi quà sinh viên ĐHTB
    REDEMPTION: {
      POINTS_PER_TRAINING: 100, // 100 ĐUT = +1 điểm rèn luyện
      MAX_TRAINING_PER_SEMESTER: 10,
      UTB_EMAIL_DOMAIN: "utb.edu.vn",
    },
  },
};
