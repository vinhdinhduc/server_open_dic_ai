const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");
const adminController = require("../controllers/adminController");

router.get("/audit-logs", authenticate, isAdmin, adminController.getAuditLogs);

router.post(
  "/audit-logs/export",
  authenticate,
  isAdmin,
  adminController.exportAuditLogs,
);

module.exports = router;
