const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");
const AuditLog = require("../models/AuditLog");

const logsDir = path.resolve(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const transport = new DailyRotateFile({
  filename: path.join(logsDir, "audit-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: false,
  maxSize: "50m",
  maxFiles: "90d",
  level: "info",
});

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [transport],
  exitOnError: false,
});

const logAuditToMongo = async (auditData) => {
  try {
    const log = new AuditLog(auditData);
    await log.save();
  } catch (error) {
    console.error("Error saving audit log to MongoDB:", error);
  }
};

const auditLog = async (auditData) => {
  try {
    logger.info(auditData);
    await logAuditToMongo(auditData);
  } catch (error) {
    console.error("Error in auditLog:", error);
  }
};

module.exports = {
  logger,
  auditLog,
};
