const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },

    actor: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        index: true,
      },
      fullName: String,
      role: String,
    },

    // Loại tài nguyên bị tác động: Term, User, Comment, Contribution, Report, etc.
    resourceType: {
      type: String,
      required: true,
      index: true,
    },

    // ID của tài nguyên bị tác động
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    // Tên tài nguyên (ví dụ: tên term, email user, etc.)
    resourceName: String,

    // Chi tiết thay đổi
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },

    // Lý do thực hiện hành động
    reason: String,

    // Trạng thái: success, failed
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },

    // Thông báo lỗi nếu có
    errorMessage: String,

    // IP address của người thực hiện
    ipAddress: String,

    // User agent
    userAgent: String,
  },
  {
    timestamps: true,
  },
);

// Compound index for common queries
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, createdAt: -1 });
auditLogSchema.index({ "actor.email": 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// TTL index to automatically remove old audit logs and prevent DB bloat.
// Configure retention via environment variable `AUDIT_LOG_RETENTION_DAYS` (default: 90).
const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || process.env.AUDIT_LOG_TTL_DAYS || '90', 10);
if (!isNaN(retentionDays) && retentionDays > 0) {
  const expireSeconds = retentionDays * 24 * 60 * 60;
  // create TTL index on `createdAt` so MongoDB will remove documents older than retentionDays
  auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: expireSeconds });
}

module.exports = mongoose.model("AuditLog", auditLogSchema);
