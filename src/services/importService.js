const xlsx = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const Term = require("../models/Term");

exports.importFromFile = async (file, userId) => {
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
      throw new Error("Định dạng file không được hỗ trợ");
    }

    // Import dữ liệu vào database
    const importedTerms = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const term = await Term.create({
          term: row.term || row["Thuật ngữ"],
          definition: row.definition || row["Định nghĩa"],
          pronunciation: row.pronunciation || row["Phát âm"],
          examples: row.examples ? JSON.parse(row.examples) : [],
          synonyms: row.synonyms
            ? row.synonyms.split(",").map((s) => s.trim())
            : [],
          createdBy: userId,
          status: "approved",
        });
        importedTerms.push(term);
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    // Xóa file tạm
    fs.unlinkSync(file.path);

    return {
      success: importedTerms.length,
      failed: errors.length,
      errors: errors.slice(0, 10), // Chỉ trả về 10 lỗi đầu tiên
    };
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
