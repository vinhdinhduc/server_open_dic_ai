const xlsx = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const Term = require("../models/Term");
const Category = require("../models/Category");
const User = require("../models/User");
const notificationService = require("./notificationService");
const emailService = require("./emailService");

exports.importFromFile = async (file, userId, categoryId) => {
  const ext = file.originalname.split(".").pop().toLowerCase();
  let data = [];

  try {
    if (ext === "xlsx" || ext === "xls") {
      // Đọc file Excel
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (ext === "csv") {
      // Đọc file CSV
      data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(file.path)
          .pipe(csv())
          .on("data", (row) => results.push(row))
          .on("end", () => resolve(results))
          .on("error", reject);
      });
    } else {
      throw new Error(
        "Định dạng file không được hỗ trợ. Hỗ trợ: xlsx, xls, csv",
      );
    }

    if (data.length === 0) {
      throw new Error("File không có dữ liệu");
    }

    // Validate category nếu có
    let defaultCategory = categoryId;
    if (categoryId) {
      const cat = await Category.findById(categoryId);
      if (!cat) {
        throw new Error("Danh mục không tồn tại");
      }
    }

    // Import dữ liệu vào database
    const importedTerms = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];

        const termVi =
          row.term_vi ||
          row["Thuật ngữ (VI)"] ||
          row["term"] ||
          row["Thuật ngữ"] ||
          "";
        const termEn =
          row.term_en || row["Thuật ngữ (EN)"] || row["term_english"] || "";
        const termLo =
          row.term_lo || row["Thuật ngữ (LO)"] || row["term_lao"] || "";
        const defVi =
          row.definition_vi ||
          row["Định nghĩa (VI)"] ||
          row["definition"] ||
          row["Định nghĩa"] ||
          "";
        const defEn = row.definition_en || row["Định nghĩa (EN)"] || "";
        const defLo = row.definition_lo || row["Định nghĩa (LO)"] || "";
        const rowCategory = row.category || row["Danh mục"] || "";
        const partOfSpeech = row.part_of_speech || row["Loại từ"] || "";

        if (!termVi) {
          errors.push({
            row: i + 2,
            error: "Thiếu thuật ngữ tiếng Việt (term_vi)",
          });
          continue;
        }
        if (!defVi) {
          errors.push({
            row: i + 2,
            error: "Thiếu định nghĩa tiếng Việt (definition_vi)",
          });
          continue;
        }

        // Determine category
        let termCategory = defaultCategory;
        if (rowCategory && !defaultCategory) {
          const cat = await Category.findOne({
            $or: [
              { "name.vi": new RegExp(`^${rowCategory}$`, "i") },
              { slug: rowCategory.toLowerCase() },
            ],
          });
          if (cat) {
            termCategory = cat._id;
          } else {
            errors.push({
              row: i + 2,
              error: `Danh mục "${rowCategory}" không tồn tại`,
            });
            continue;
          }
        }

        if (!termCategory) {
          errors.push({ row: i + 2, error: "Thiếu danh mục" });
          continue;
        }

        // Check duplicates
        const existing = await Term.findOne({
          "term.vi": termVi,
          category: termCategory,
        });
        if (existing) {
          errors.push({
            row: i + 2,
            error: `Thuật ngữ "${termVi}" đã tồn tại trong danh mục này`,
          });
          continue;
        }

        const term = await Term.create({
          term: { vi: termVi, en: termEn, lo: termLo },
          definition: { vi: defVi, en: defEn, lo: defLo },
          partOfSpeech,
          category: termCategory,
          createdBy: userId,
          status: "approved",
        });

        // Update category term count
        await Category.findByIdAndUpdate(termCategory, {
          $inc: { termCount: 1 },
        });

        importedTerms.push(term);
      } catch (error) {
        errors.push({ row: i + 2, error: error.message });
      }
    }

    // Xóa file tạm
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const result = {
      total: data.length,
      success: importedTerms.length,
      failed: errors.length,
      errors: errors.slice(0, 20),
    };

    // Gửi thông báo cho tất cả admin
    try {
      const admins = await User.find({ role: "admin", status: "active" });
      const importUser = await User.findById(userId);

      for (const admin of admins) {
        // Thông báo trong hệ thống
        await notificationService.createNotification({
          recipient: admin._id,
          type: "system",
          title: "Nhập dữ liệu hoàn tất",
          message: `${importUser?.fullName || "Admin"} đã nhập ${result.success}/${result.total} thuật ngữ từ file "${file.originalname}"`,
          relatedModel: null,
        });

        // Gửi email thông báo
        emailService
          .sendImportNotificationEmail(admin.email, admin.fullName, {
            fileName: file.originalname,
            ...result,
          })
          .catch((err) => console.error("Failed to send import email:", err));
      }
    } catch (notifError) {
      console.error("Error sending import notifications:", notifError);
    }

    return result;
  } catch (error) {
    // Xóa file tạm nếu có lỗi
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

exports.getImportHistory = async (page, limit) => {
  // TODO: Implement import history tracking
  return {
    history: [],
    totalPages: 0,
    currentPage: page,
  };
};
