const { auditLog } = require("../logger/auditLogger");

const ACTIONS = {
  TERM_CREATE: "TERM_CREATE",
  TERM_UPDATE: "TERM_UPDATE",
  TERM_DELETE: "TERM_DELETE",
  TERM_APPROVE: "TERM_APPROVE",
  TERM_REJECT: "TERM_REJECT",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DELETE: "USER_DELETE",
  USER_BAN: "USER_BAN",
  USER_LOCK: "USER_LOCK",
  USER_UNBAN: "USER_UNBAN",
  ROLE_CHANGE: "ROLE_CHANGE",
  REPORT_CREATE: "REPORT_CREATE",
  REPORT_RESOLVED: "REPORT_RESOLVED",
  REPORT_REJECTED: "REPORT_REJECTED",
  CONTRIBUTION_APPROVE: "CONTRIBUTION_APPROVE",
  CONTRIBUTION_REJECT: "CONTRIBUTION_REJECT",
  CONTRIBUTION_DELETE: "CONTRIBUTION_DELETE",
  COMMENT_DELETE: "COMMENT_DELETE",
  COMMENT_APPROVE: "COMMENT_APPROVE",
  COMMENT_REJECT: "COMMENT_REJECT",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  EMAIL_VERIFY: "EMAIL_VERIFY",
};

function logAudit(params) {
  try {
    const auditData = {
      action: params.action,
      actor: {
        _id: params.actor?.userId || params.actor?._id || null,
        email: params.actor?.email || null,
        fullName: params.actor?.fullName || null,
        role: params.actor?.role || null,
      },
      resourceType:
        params.target?.resourceType || params.target?.resource || null,
      resourceId:
        params.target?.resourceId || params.target?.resourceId || null,
      resourceName:
        params.target?.resourceName || params.target?.resourceName || null,
      changes: params.diff || null,
      reason: params.reason || null,
      ipAddress: params.actor?.ip || params.ip || null,
      userAgent: params.actor?.userAgent || null,
      status:
        params.status || (params.success === false ? "failed" : "success"),
    };

    if (
      !auditData.action ||
      !auditData.actor?.email ||
      !auditData.resourceType
    ) {
      return;
    }

    auditLog(auditData);
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

module.exports = { logAudit, ACTIONS };
