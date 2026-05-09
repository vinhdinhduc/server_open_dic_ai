const { auditLog } = require("../logger/auditLogger");

const logAuditAction = async (options) => {
  try {
    const {
      action,
      actor,
      resourceType,
      resourceId,
      resourceName,
      changes,
      reason,
      ipAddress,
      userAgent,
      success = true,
      errorMessage,
    } = options;

    const auditData = {
      action,
      actor: {
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
        _id: actor._id,
      },
      resourceType,
      resourceId,
      resourceName,
      changes,
      reason,
      ipAddress,
      userAgent,
      status: success ? "success" : "failed",
      errorMessage,
    };

    await auditLog(auditData);

    return { success: true };
  } catch (error) {
    console.error("Error logging audit action:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { logAuditAction };
