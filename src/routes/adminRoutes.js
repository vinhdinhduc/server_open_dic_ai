const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { isAdmin } = require("../middlewares/authorize");
const { successResponse, errorResponse } = require("../utils/response");
const Papa = require("papaparse");

// GET /admin/audit-logs?date=YYYY-MM-DD&action=TERM_CREATE&actorEmail=foo&page=1&limit=50
router.get("/audit-logs", isAdmin, async (req, res) => {
  try {
    const { date, action, actorEmail } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    // Filter by date (ngày bắt đầu từ 00:00:00 đến 23:59:59)
    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Filter by action
    if (action) {
      filter.action = action;
    }

    // Filter by actor email
    if (actorEmail) {
      filter["actor.email"] = { $regex: actorEmail, $options: "i" };
    }

    // Query
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return successResponse(res, "Lấy audit logs thành công", {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return errorResponse(res, "Lỗi khi đọc audit logs", 500, error.message);
  }
});

// POST /admin/audit-logs/export?date=YYYY-MM-DD&action=TERM_CREATE&actorEmail=foo
// Export audit logs to CSV for a given date
router.post("/audit-logs/export", isAdmin, async (req, res) => {
  try {
    const { date, action, actorEmail } = req.query;

    // Build filter
    const filter = {};

    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    if (action) {
      filter.action = action;
    }

    if (actorEmail) {
      filter["actor.email"] = { $regex: actorEmail, $options: "i" };
    }

    // Fetch all matching logs (no pagination)
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).lean();

    // Format data for CSV
    const csvData = logs.map((log) => ({
      "Thời gian": new Date(log.createdAt).toLocaleString("vi-VN"),
      "Hành vi": log.action,
      "Người thực hiện": log.actor.email,
      "Tên người dùng": log.actor.fullName || "",
      "Vai trò": log.actor.role || "",
      "Loại tài nguyên": log.resourceType,
      "Tên tài nguyên": log.resourceName || "",
      "Lý do": log.reason || "",
      "Trạng thái": log.status,
      "Thông báo lỗi": log.errorMessage || "",
      "IP Address": log.ipAddress || "",
    }));

    // Convert to CSV
    const csv = Papa.unparse(csvData, {
      quotes: true,
      delimiter: ",",
      newline: "\r\n",
      header: true,
    });
    const csvWithBom = `\ufeff${csv}`;

    // Set response headers
    const fileName = `audit-logs-${date || "all"}-${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csvWithBom);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return errorResponse(res, "Lỗi khi xuất audit logs", 500, error.message);
  }
});

module.exports = router;
