const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const pickFirstExisting = (candidates = [], fallback) => {
  const found = candidates.find((fontPath) => fs.existsSync(fontPath));
  return found || fallback;
};

const FONTS = {
  regular: pickFirstExisting(
    [
      "C:\\Windows\\Fonts\\arial.ttf",
      "C:\\Windows\\Fonts\\segoeui.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
    "Helvetica",
  ),
  bold: pickFirstExisting(
    [
      "C:\\Windows\\Fonts\\arialbd.ttf",
      "C:\\Windows\\Fonts\\segoeuib.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    "Helvetica-Bold",
  ),
  italic: pickFirstExisting(
    [
      "C:\\Windows\\Fonts\\ariali.ttf",
      "C:\\Windows\\Fonts\\segoeuii.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    ],
    "Helvetica-Oblique",
  ),
  serif: pickFirstExisting(
    [
      "C:\\Windows\\Fonts\\timesbi.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSerif-BoldItalic.ttf",
    ],
    "Times-BoldItalic",
  ),
};
const CERTIFICATE_TEMPLATE = path.join(__dirname, "certificates");

if (!fs.existsSync(CERTIFICATE_TEMPLATE)) {
  fs.mkdirSync(CERTIFICATE_TEMPLATE, { recursive: true });
}

const C = {
  navy: "#1a3a6b",
  blue: "#1a56db",
  blueLight: "#dbeafe",
  bluePale: "#eff6ff",
  red: "#b91c1c",
  redLight: "#fef2f2",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  white: "#ffffff",
  black: "#111827",
  line: "#cbd5e1",
};

const summarizeContributions = (history = []) => {
  const map = {
    contribution: { label: "Đóng góp thuật ngữ/ chỉnh sửa", total: 0 },
    report: { label: "Báo xấu", total: 0 },
    bonus: { label: "Điểm thưởng", total: 0 },
    penalty: { label: "Điểm phạt", total: 0 },
  };

  for (const item of history) {
    if (map[item.category]) {
      map[item.category].total += item.points;
    }
  }
  return Object.values(map).filter((v) => v.total !== 0);
};

const formatDate = (date) => {
  const d = new Date(date);
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
};
function hLine(doc, y, x1 = 40, x2 = 555, color = C.line, width = 0.5) {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke()
    .restore();
}

function colorBar(doc, y, h = 8, color = C.navy) {
  doc.save().rect(40, y, 515, h).fill(color).restore();
}
function sectionHeader(doc, y, text) {
  colorBar(doc, y, 18, C.bluePale);
  doc
    .save()
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(C.navy)
    .text(text, 46, y + 4, { width: 503 })
    .restore();
  return y + 22;
}
function infoRow(doc, y, label, value) {
  doc
    .save()
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor("#374151")
    .text(label, 55, y, { width: 140, lineBreak: false })
    .font(FONTS.regular)
    .fillColor(C.black)
    .text(value, 200, y, { width: 355 })
    .restore();
  return y + 16;
}

exports.generateCertificate = async (request, user, history = []) => {
  const fileName = `${request.certificateNumber}.pdf`;
  const filePath = path.join(CERTIFICATE_TEMPLATE, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: { top: 40, bottom: 40, right: 40, left: 40 },
        info: {
          Title: `Giấy xác nhận cộng điểm rèn luyện - ${request.certificateNumber}`,
          Author: "Hệ thống UTB Opendict - Trường Đại học Tây Bắc",
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const PW = 595;
      let y = 28;

      doc
        .save()
        .rect(18, 18, PW - 36, 806)
        .lineWidth(1.5)
        .strokeColor(C.blue)
        .stroke()
        .rect(22, 22, PW - 44, 798)
        .lineWidth(0.4)
        .strokeColor("#93c5fd")
        .stroke()
        .restore();

      doc
        .font(FONTS.bold)
        .fontSize(14)
        .fillColor(C.navy)
        .text("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", 40, y, {
          align: "center",
          width: 515,
        });
      y += 16;
      doc
        .font(FONTS.bold)
        .fontSize(10.5)
        .fillColor(C.navy)
        .text("Độc lập – Tự do – Hạnh phúc", 40, y, {
          align: "center",
          width: 515,
        });
      y += 14;

      doc
        .save()
        .strokeColor(C.navy)
        .lineWidth(0.8)
        .moveTo(PW / 2 - 80, y)
        .lineTo(PW / 2 + 80, y)
        .stroke()
        .restore();

      y += 4;

      doc
        .font(FONTS.bold)
        .fontSize(10)
        .fillColor("#374151")
        .text("TRƯỜNG ĐẠI HỌC TÂY BẮC", 40, y, { width: 240, align: "center" });
      doc
        .font(FONTS.regular)
        .fontSize(8.5)
        .fillColor(C.gray)
        .text("(Tây Bắc University – UTB)", 40, y + 13, {
          width: 240,
          align: "center",
        })
        .text("Hệ thống Từ điển mở UTB OpenDict", 40, y + 23, {
          width: 240,
          align: "center",
        });

      const issued = new Date(request.reviewedAt || new Date());

      doc
        .font(FONTS.italic)
        .fontSize(9.5)
        .fillColor("#374151")
        .text(`Sơn La, ${formatDate(issued)}`, 315, y + 10, {
          width: 240,
          align: "center",
        });
      y += 40;

      colorBar(doc, y, 3, C.blue);
      y += 10;

      doc
        .font(FONTS.bold)
        .fontSize(17)
        .fillColor(C.navy)
        .text("GIẤY XÁC NHẬN", 40, y, { align: "center", width: 515 });
      y += 22;
      doc
        .font(FONTS.bold)
        .fontSize(13)
        .fillColor(C.red)
        .text("ĐỀ XUẤT CỘNG ĐIỂM RÈN LUYỆN", 40, y, {
          align: "center",
          width: 515,
        });
      y += 18;

      doc
        .font(FONTS.regular)
        .fontSize(9.5)
        .fillColor(C.gray)
        .text(`Năm học / Học kỳ: ${request.semester}`, 40, y, {
          align: "center",
          width: 515,
        });
      y += 14;

      hLine(doc, y);
      y += 10;

      doc
        .font(FONTS.regular)
        .fontSize(10)
        .fillColor(C.black)
        .text("Kính gửi:", 55, y, { continued: false });

      const kinhGui = [
        "– Ban Giám hiệu Trường Đại học Tây Bắc;",
        `– Phòng Công tác chính trị & QLNH – Trường Đại học Tây Bắc;`,
        `– Khoa ${request.faculty || user.faculty || "..."}.`,
      ];
      doc.font(FONTS.regular).fontSize(10).fillColor(C.black);
      for (const line of kinhGui) {
        doc.text(line, 110, y, { width: 405 });
        y += 15;
      }
      y += 4;

      //Info sv
      y = sectionHeader(doc, y, "I. THÔNG TIN SINH VIÊN");

      const studentRows = [
        ["Họ và tên:", user.fullName || "N/A"],
        ["Mã sinh viên:", request.studentId || "N/A"],
        ["Lớp:", request.studentClass || "N/A"],
        ["Khoa:", request.faculty || "N/A"],
        ["Số điện thoại:", request.phone || "N/A"],
        ["Địa chỉ email:", user.email || "N/A"],
      ];

      for (const [label, value] of studentRows) {
        y = infoRow(doc, y, label, value);
      }

      y += 6;

      y = sectionHeader(doc, y, "II.  ĐÓNG GÓP CHO HỆ THỐNG UTB OPENDICT");
      y += 2;

      // Table header
      const TH = 20;
      const COLS = {
        stt: 40,
        sttW: 30,
        label: 70,
        labelW: 295,
        pts: 365,
        ptsW: 80,
        note: 445,
        noteW: 110,
      };
      doc.save().rect(40, y, 515, TH).fill(C.blue).restore();
      doc.font(FONTS.bold).fontSize(9).fillColor(C.white);
      doc.text("STT", COLS.stt + 5, y + 5, { width: COLS.sttW });
      doc.text("Hạng mục đóng góp", COLS.label + 5, y + 5, {
        width: COLS.labelW,
      });
      doc.text("Điểm (ĐUT)", COLS.pts + 5, y + 5, { width: COLS.ptsW });
      doc.text("Ghi chú", COLS.note + 5, y + 5, { width: COLS.noteW });
      y += TH;

      const summaryRows = summarizeContributions(history);
      for (let i = 0; i < summaryRows.length; i++) {
        const row = summaryRows[i];
        const rowBg = i % 2 === 0 ? C.bluePale : C.white;
        doc.save().rect(40, y, 515, 18).fill(rowBg).restore();
        doc.font(FONTS.regular).fontSize(9).fillColor(C.black);
        doc.text(`${i + 1}`, COLS.stt + 5, y + 4, { width: COLS.sttW });
        doc.text(row.label, COLS.label + 5, y + 4, { width: COLS.labelW });
        const ptStr = `${row.total > 0 ? "+" : ""}${row.total}`;
        doc
          .font(FONTS.bold)
          .fillColor(row.total > 0 ? "#15803d" : C.red)
          .text(ptStr, COLS.pts + 5, y + 4, { width: COLS.ptsW });
        doc
          .font(FONTS.regular)
          .fillColor(C.gray)
          .text("", COLS.note + 5, y + 4, { width: COLS.noteW });
        y += 18;
      }

      // Total row
      doc.save().rect(40, y, 515, 20).fill(C.navy).restore();
      doc
        .font(FONTS.bold)
        .fontSize(9.5)
        .fillColor(C.white)
        .text(
          "Tổng Điểm Uy Tín (ĐUT) đề xuất quy đổi:",
          COLS.label + 5,
          y + 5,
          {
            width: COLS.labelW,
          },
        );
      doc
        .font(FONTS.bold)
        .fontSize(10)
        .fillColor("#fde68a")
        .text(`${request.pointsUsed} ĐUT`, COLS.pts + 5, y + 5, {
          width: COLS.ptsW,
        });
      y += 26;

      y = sectionHeader(doc, y, "III.  ĐỀ XUẤT CỘNG ĐIỂM RÈN LUYỆN");
      y += 4;

      // Đoạn văn đề xuất
      doc
        .font(FONTS.regular)
        .fontSize(10)
        .fillColor(C.black)
        .text(
          `Căn cứ vào đóng góp thực tế của sinh viên ${user.fullName} ` +
            `(MSV: ${request.studentId}) trên hệ thống Từ điển mở UTB OpenDict trong ` +
            `${request.semester}, Ban quản trị hệ thống trân trọng đề xuất ` +
            `Phòng Công tác Chính trị & QLNH xem xét và phê duyệt cộng điểm rèn luyện ` +
            `cho sinh viên như sau:`,
          60,
          y,
          { width: 475, align: "justify" },
        );
      y = doc.y + 10;

      // Ô điểm nổi bật
      doc
        .save()
        .rect(140, y, 315, 52)
        .fill(C.redLight)
        .rect(140, y, 315, 52)
        .lineWidth(1.2)
        .strokeColor(C.red)
        .stroke()
        .restore();
      doc
        .font(FONTS.bold)
        .fontSize(26)
        .fillColor(C.red)
        .text(`+${request.trainingPointsGained} điểm rèn luyện`, 140, y + 6, {
          width: 315,
          align: "center",
        });
      doc
        .font(FONTS.italic)
        .fontSize(9)
        .fillColor(C.gray)
        .text(
          `(${request.pointsUsed} ĐUT ÷ 100 = ${request.trainingPointsGained} điểm rèn luyện)`,
          140,
          y + 36,
          { width: 315, align: "center" },
        );
      y += 62;

      hLine(doc, y);
      y += 10;

      doc.save().rect(40, y, 515, 18).fill(C.grayLight).restore();
      doc
        .font(FONTS.regular)
        .fontSize(8.5)
        .fillColor(C.gray)
        .text(`Mã chứng nhận: ${request.certificateNumber}`, 46, y + 4, {
          width: 250,
        })
        .text(`Ngày cấp: ${formatDate(issued)}`, 46, y + 4, {
          width: 509,
          align: "right",
        });
      y += 26;

      //Chữ ký

      const sigY = y;
      const SIG = [
        {
          x: 42,
          w: 155,
          title: "SINH VIÊN",
          sub: "(Ký và ghi rõ họ tên)",
          name: user.fullName,
        },
        {
          x: 217,
          w: 165,
          title: `TRƯỞNG KHOA ${request.faculty || ""}`,
          sub: "(Ký, đóng dấu)",
          name: "",
        },
        {
          x: 402,
          w: 155,
          title: "BAN QUẢN TRỊ UTB OPENDICT",
          sub: "(Ký, đóng dấu)",
          name: "",
        },
      ];

      for (const s of SIG) {
        doc
          .font(FONTS.bold)
          .fontSize(9.5)
          .fillColor(C.navy)
          .text(s.title, s.x, sigY, { width: s.w, align: "center" });
        doc
          .font(FONTS.italic)
          .fontSize(8.5)
          .fillColor(C.gray)
          .text(s.sub, s.x, sigY + 13, { width: s.w, align: "center" });

        if (s.name) {
          doc
            .font(FONTS.bold)
            .fontSize(9)
            .fillColor(C.black)
            .text(s.name, s.x, sigY + 68, { width: s.w, align: "center" });
        }
      }
      y = sigY + 80;

      hLine(doc, y, 40, 555, C.line);
      y += 6;
      doc
        .font(FONTS.italic)
        .fontSize(8)
        .fillColor(C.gray)
        .text(
          " Lưu ý: Giấy xác nhận này chỉ có hiệu lực sau khi được Phòng Công tác Chính trị & QLNH " +
            "Trường Đại học Tây Bắc ký xác nhận và đóng dấu. " +
            "Tối đa 10 điểm rèn luyện/học kỳ được quy đổi từ hệ thống UTB OpenDict. " +
            "Tài liệu được tạo tự động — vui lòng liên hệ Ban quản trị để xác minh tính hợp lệ.",
          40,
          y,
          { width: 515, align: "center" },
        );

      doc.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};
exports.getCertificatePath = (certificateNumber) => {
  const filePath = path.join(CERTIFICATE_TEMPLATE, `${certificateNumber}.pdf`);
  return fs.existsSync(filePath) ? filePath : null;
};
