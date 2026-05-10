const AuditLog = require("../models/AuditLog");
const Papa = require("papaparse");
const { successResponse, errorResponse } = require("../utils/response");

const getDateRangeForTimezone = (dateString, timezoneOffsetMinutes = 0) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const offset = Number.isFinite(timezoneOffsetMinutes)
    ? timezoneOffsetMinutes
    : 0;

  const startUtcMs = Date.UTC(year, month - 1, day) + offset * 60 * 1000;
  const endUtcMs = Date.UTC(year, month - 1, day + 1) + offset * 60 * 1000 - 1;

  return {
    startDate: new Date(startUtcMs),
    endDate: new Date(endUtcMs),
  };
};

const buildAuditLogFilter = (query) => {
  const { date, action, actorEmail, timezoneOffsetMinutes } = query;
  const filter = {};

  if (date) {
    const { startDate, endDate } = getDateRangeForTimezone(
      date,
      parseInt(timezoneOffsetMinutes, 10),
    );
    filter.createdAt = { $gte: startDate, $lte: endDate };
  }

  if (action) {
    filter.action = action;
  }

  if (actorEmail) {
    filter["actor.email"] = { $regex: actorEmail, $options: "i" };
  }

  return filter;
};

exports.getAuditLogs = async (req, res) => {
  try {
    console.log("call getAuditLogs with query:", req.query);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;
    const filter = buildAuditLogFilter(req.query);

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    console.log("Fetched audit logs with filter:", filter, "Total:", total);
    console.log("logs:", logs);
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
};

exports.exportAuditLogs = async (req, res) => {
  try {
    const { date } = req.query;
    const filter = buildAuditLogFilter(req.query);

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).lean();

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

    const csv = Papa.unparse(csvData, {
      quotes: true,
      delimiter: ",",
      newline: "\r\n",
      header: true,
    });
    const csvWithBom = `\ufeff${csv}`;

    const fileName = `audit-logs-${date || "all"}-${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csvWithBom);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return errorResponse(res, "Lỗi khi xuất audit logs", 500, error.message);
  }
};
