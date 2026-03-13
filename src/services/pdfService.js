const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const CERTIFICATES_DIR = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "certificates",
);

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(CERTIFICATES_DIR)) {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

/**
 * Lấy danh sách đóng góp của user (tóm tắt)
 * contributions: mảng lấy từ ReputationHistory
 */
const summarizeContributions = (history = []) => {
  const map = {
    contribution: { label: "Đóng góp thuật ngữ / chỉnh sửa", total: 0 },
    report: { label: "Báo cáo vi phạm", total: 0 },
    bonus: { label: "Thưởng (streak, milestone,...)", total: 0 },
    penalty: { label: "Phạt", total: 0 },
  };

  for (const item of history) {
    if (map[item.category]) {
      map[item.category].total += item.points;
    }
  }

  return Object.values(map).filter((v) => v.total !== 0);
};

/**
 * Tạo file PDF giấy xác nhận đổi điểm rèn luyện
 * @param {Object} request - RedemptionRequest document (populated user)
 * @param {Object} user    - User document
 * @param {Array}  history - ReputationHistory array
 * @returns {string} Đường dẫn tuyệt đối tới file PDF
 */
exports.generateCertificate = async (request, user, history = []) => {
  const fileName = `${request.certificateNumber}.pdf`;
  const filePath = path.join(CERTIFICATES_DIR, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Giấy xác nhận điểm rèn luyện - ${request.certificateNumber}`,
          Author: "OpenDict - ĐHTB",
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = doc.page.width - 100; // margin both sides
      const centerX = doc.page.width / 2;

      // ─────────────────────── HEADER ───────────────────────
      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#555")
        .text("TRƯỜNG ĐẠI HỌC THÁI BÌNH", { align: "center" })
        .text("(Thai Binh University - TBU)", { align: "center" })
        .moveDown(0.3);

      doc
        .strokeColor("#1a56db")
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

      doc.moveDown(0.8);

      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#1a3a6b")
        .text("GIẤY XÁC NHẬN", { align: "center" })
        .moveDown(0.2);

      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#c0392b")
        .text("ĐỀ XUẤT CỘNG ĐIỂM RÈN LUYỆN", { align: "center" })
        .moveDown(0.2);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#555")
        .text(
          `Hệ thống từ điển mở OpenDict | Năm học / học kỳ: ${request.semester}`,
          { align: "center" },
        )
        .moveDown(1.2);

      // ─────────────────────── STUDENT INFO ───────────────────────
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#1a3a6b")
        .text("I. THÔNG TIN SINH VIÊN", { underline: true })
        .moveDown(0.5);

      const studentName = user.fullName || "N/A";
      const studentId = request.studentId || "N/A";
      const studentClass = request.studentClass || "N/A";
      const faculty = request.faculty || "N/A";
      const phone = request.phone || "N/A";
      const email = user.email || "N/A";

      const infoRows = [
        ["Họ và tên:", studentName],
        ["MSSV:", studentId],
        ["Lớp:", studentClass],
        ["Khoa:", faculty],
        ["Số điện thoại:", phone],
        ["Email:", email],
      ];

      const col1X = 70;
      const col2X = 230;

      for (const [label, value] of infoRows) {
        const y = doc.y;
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#333")
          .text(label, col1X, y, { width: 150, continued: false });
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#000")
          .text(value, col2X, y, { width: pageWidth - col2X + 50 });
        doc.moveDown(0.3);
      }

      doc.moveDown(0.5);

      // ─────────────────────── CONTRIBUTION SUMMARY ───────────────────────
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#1a3a6b")
        .text("II. ĐÓNG GÓP CHO HỆ THỐNG OPENDICT", { underline: true })
        .moveDown(0.5);

      const summaryRows = summarizeContributions(history);
      const tableTop = doc.y;
      const colW = [30, 290, 100];
      const tableTotalWidth = colW.reduce((a, b) => a + b, 0);
      const tableLeft = 50;

      // Table header
      doc
        .fillColor("#1a56db")
        .rect(tableLeft, tableTop, tableTotalWidth, 22)
        .fill();
      doc
        .fillColor("#fff")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("STT", tableLeft + 5, tableTop + 6, { width: colW[0] })
        .text("Hạng mục đóng góp", tableLeft + colW[0] + 5, tableTop + 6, {
          width: colW[1],
        })
        .text("Điểm", tableLeft + colW[0] + colW[1] + 5, tableTop + 6, {
          width: colW[2],
        });

      let rowY = tableTop + 22;
      summaryRows.forEach((row, i) => {
        const bg = i % 2 === 0 ? "#f0f4ff" : "#ffffff";
        doc.fillColor(bg).rect(tableLeft, rowY, tableTotalWidth, 20).fill();
        doc
          .fillColor("#000")
          .fontSize(10)
          .font("Helvetica")
          .text(`${i + 1}`, tableLeft + 5, rowY + 5, { width: colW[0] })
          .text(row.label, tableLeft + colW[0] + 5, rowY + 5, {
            width: colW[1],
          })
          .text(
            `${row.total > 0 ? "+" : ""}${row.total} ĐUT`,
            tableLeft + colW[0] + colW[1] + 5,
            rowY + 5,
            { width: colW[2] },
          );
        rowY += 20;
      });

      // Total points row
      doc
        .fillColor("#1a3a6b")
        .rect(tableLeft, rowY, tableTotalWidth, 22)
        .fill();
      doc
        .fillColor("#fff")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Tổng ĐUT tích lũy:", tableLeft + colW[0] + 5, rowY + 6, {
          width: colW[1],
        })
        .text(
          `${request.pointsUsed} ĐUT`,
          tableLeft + colW[0] + colW[1] + 5,
          rowY + 6,
          { width: colW[2] },
        );
      rowY += 22;

      doc.moveDown(0.5);
      doc.y = rowY + 10;

      // ─────────────────────── PROPOSAL ───────────────────────
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#1a3a6b")
        .text("III. ĐỀ XUẤT CỘNG ĐIỂM RÈN LUYỆN", { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#000")
        .text(
          `Căn cứ vào đóng góp thực tế của sinh viên trên hệ thống OpenDict trong học kỳ ` +
            `${request.semester}, Ban quản trị đề xuất cộng:`,
          { indent: 20 },
        )
        .moveDown(0.5);

      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#c0392b")
        .text(`+${request.trainingPointsGained} điểm rèn luyện`, {
          align: "center",
        })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#555")
        .text(
          `(${request.pointsUsed} ĐUT × tỷ lệ quy đổi = ${request.trainingPointsGained} điểm rèn luyện)`,
          { align: "center" },
        )
        .moveDown(1);

      // ─────────────────────── CERTIFICATE INFO ───────────────────────
      doc
        .strokeColor("#aaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke()
        .moveDown(0.5);

      const issuedDate = new Date(request.reviewedAt || new Date());
      const dateStr = `ngày ${issuedDate.getDate()} tháng ${issuedDate.getMonth() + 1} năm ${issuedDate.getFullYear()}`;

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#555")
        .text(`Mã chứng nhận: ${request.certificateNumber}`, 50, doc.y)
        .text(`Ngày cấp: ${dateStr}`, { align: "right" })
        .moveDown(1.5);

      // ─────────────────────── SIGNATURES ───────────────────────
      const sigY = doc.y;
      const sig1X = 80;
      const sig2X = doc.page.width - 230;

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text("SINH VIÊN XÁC NHẬN", sig1X, sigY, {
          width: 160,
          align: "center",
        })
        .text("BAN QUẢN TRỊ OPENDICT", sig2X, sigY, {
          width: 160,
          align: "center",
        });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#777")
        .text("(Ký và ghi rõ họ tên)", sig1X, sigY + 14, {
          width: 160,
          align: "center",
        })
        .text("(Ký, đóng dấu)", sig2X, sigY + 14, {
          width: 160,
          align: "center",
        });

      // Signature placeholder lines
      const lineY = sigY + 70;
      doc
        .strokeColor("#000")
        .lineWidth(0.8)
        .moveTo(sig1X, lineY)
        .lineTo(sig1X + 160, lineY)
        .stroke()
        .moveTo(sig2X, lineY)
        .lineTo(sig2X + 160, lineY)
        .stroke();

      // Student name under sig line
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text(studentName, sig1X, lineY + 5, { width: 160, align: "center" });

      // ─────────────────────── FOOTER ───────────────────────
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#aaa")
        .text(
          "Tài liệu này được tạo tự động bởi hệ thống OpenDict. Vui lòng liên hệ Ban quản trị khi cần xác nhận tính hợp lệ.",
          50,
          doc.page.height - 50,
          { width: pageWidth, align: "center" },
        );

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Trả về đường dẫn file certificate nếu tồn tại
 */
exports.getCertificatePath = (certificateNumber) => {
  const filePath = path.join(CERTIFICATES_DIR, `${certificateNumber}.pdf`);
  return fs.existsSync(filePath) ? filePath : null;
};
