const { auditLog } = require("../logger/auditLogger");

const ACTIONS = {
  APPROVE_TERM: "approve_term",
  DELETE_TERM: "delete_term",
  BAN_USER: "ban_user",
  CREATE_TERM: "create_term",
  UPDATE_TERM: "update_term",
  REJECT_TERM: "reject_term",
  LOGIN: "login",
  LOGOUT: "logout",
  CHANGE_ROLE: "change_role",
  LOCK_ACCOUNT: "lock_account",
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

    auditLog(auditData);
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

module.exports = { logAudit, ACTIONS };
