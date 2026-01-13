const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const importController = require("../controllers/importController");
const { protect } = require("../middlewares/auth");
const { authorize } = require("../middlewares/authorize");

// Cấu hình multer để upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".xlsx" && ext !== ".xls" && ext !== ".csv") {
      return cb(new Error("Chỉ chấp nhận file Excel hoặc CSV"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Import dữ liệu (chỉ admin)
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.single("file"),
  importController.importTerms
);

// Lấy lịch sử import (chỉ admin)
router.get(
  "/history",
  protect,
  authorize("admin"),
  importController.getImportHistory
);

module.exports = router;
