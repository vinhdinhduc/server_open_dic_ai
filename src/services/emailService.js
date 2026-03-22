const nodemailer = require("nodemailer");
const SystemConfig = require("../models/SystemConfig");
const { APP_NAME } = require("../utils/constants");

const getEmailTransporter = async () => {
  const emailHost = await SystemConfig.getValue("email_host", "smtp.gmail.com");
  const emailPort = await SystemConfig.getValue("email_port", 587);
  const emailSecure = await SystemConfig.getValue("email_secure", false);
  const emailUser = await SystemConfig.getValue(
    "email_user",
    process.env.EMAIL_USER,
  );
  const emailPassword = await SystemConfig.getValue(
    "email_password",
    process.env.EMAIL_PASSWORD,
  );

  if (!emailUser || !emailPassword) {
    throw new Error(
      "Email configuration is missing (email_user / email_password)",
    );
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailSecure,
    auth: { user: emailUser, pass: emailPassword },
    tls: { rejectUnauthorized: false },
  });
};

const getMailConfig = async () => {
  const transporter = await getEmailTransporter();
  const emailFrom = await SystemConfig.getValue(
    "email_from",
    process.env.EMAIL_FROM,
  );
  const emailFromName = await SystemConfig.getValue(
    "email_from_name",
    process.env.EMAIL_FROM_NAME || APP_NAME,
  );
  return { transporter, from: `${emailFromName} <${emailFrom}>` };
};

/**
 * Wraps HTML body content in a consistent, nicely styled email shell.
 *
 * @param {string} title       - Card heading (text only).
 * @param {string} accentColor - Hex colour for the header & accents.
 * @param {string} bodyHtml    - Inner HTML (paragraphs, boxes, buttons …).
 * @returns {string}           - Full HTML for the email.
 */
const buildEmailHtml = (title, accentColor, bodyHtml) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                      box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${accentColor};padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                 UTB OpenDict
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 20px;color:${accentColor};font-size:20px;font-weight:700;">
                ${title}
              </h2>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Email này được gửi tự động từ hệ thống <strong>UTB OpenDict</strong>.<br/>
                Vui lòng không trả lời email này.
              </p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} UTB OpenDict — Nền tảng từ điển mở cho cộng đồng
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** Highlighted info box. */
const infoBox = (bgColor, borderColor, content) => `
<div style="background:${bgColor};border-left:4px solid ${borderColor};border-radius:6px;
            padding:16px 20px;margin:20px 0;">
  ${content}
</div>`;

/** Centred CTA button. */
const ctaButton = (href, label, color) => `
<div style="text-align:center;margin:28px 0;">
  <a href="${href}"
     style="display:inline-block;padding:14px 36px;background:${color};color:#ffffff;
            text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;
            letter-spacing:0.3px;">
    ${label}
  </a>
</div>`;

/** Fallback plain-text link row. */
const fallbackLink = (url) => `
<p style="color:#64748b;font-size:13px;margin:12px 0 0;">
  Hoặc sao chép liên kết này vào trình duyệt:
</p>
<p style="color:#3b82f6;word-break:break-all;font-size:13px;margin:4px 0 0;">${url}</p>`;

/** Standard greeting line. */
const greeting = (name) =>
  `<p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 12px;">
    Xin chào <strong>${name}</strong>,
  </p>`;

/** Standard sign-off. */
const signOff = () =>
  `<p style="color:#334155;font-size:14px;margin:28px 0 0;line-height:1.6;">
    Trân trọng,<br/><strong>Đội ngũ UTB OpenDict</strong>
  </p>`;

const isEmailNotificationEnabled = async (userEmail, type) => {
  try {
    const User = require("../models/User");
    const user = await User.findOne({ email: userEmail }).select(
      "emailNotifications",
    );
    if (!user) return false;

    return user.emailNotifications?.[type] !== false;
  } catch {
    return true;
  }
};

/**
 * Gửi email xác thực tài khoản khi đăng ký.
 */
exports.sendVerificationEmail = async (
  userEmail,
  userName,
  verificationToken,
) => {
  try {
    const { transporter, from } = await getMailConfig();
    const url = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Cảm ơn bạn đã đăng ký tài khoản tại <strong> UTB OpenDict</strong>.
        Nhấn nút bên dưới để xác thực địa chỉ email và kích hoạt tài khoản.
      </p>
      ${ctaButton(url, " Xác thực email", "#16a34a")}
      ${fallbackLink(url)}
      ${infoBox(
        "#fef9c3",
        "#f59e0b",
        `<p style="margin:0;color:#92400e;font-size:13px;">
           Liên kết này sẽ hết hạn sau <strong>24 giờ</strong>.
          Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.
        </p>`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Xác thực tài khoản — OpenDict",
      html: buildEmailHtml("Xác thực tài khoản", "#16a34a", body),
    });
    console.log(`[Email] Verification sent  ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendVerificationEmail error:", error);
    throw error;
  }
};

/**
 * Gửi email chào mừng sau khi xác thực thành công.
 */
exports.sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const { transporter, from } = await getMailConfig();

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Tài khoản của bạn đã được xác thực thành công.
        Hãy bắt đầu khám phá <strong>OpenDict</strong>!
      </p>
      ${infoBox(
        "#f0fdf4",
        "#16a34a",
        `
        <p style="margin:0 0 8px;color:#166534;font-weight:700;font-size:14px;"> Bạn có thể ngay bây giờ:</p>
        <ul style="margin:0;padding-left:20px;color:#166534;font-size:14px;line-height:1.8;">
          <li>Tra cứu hàng nghìn thuật ngữ từ nhiều từ điển</li>
          <li>Đóng góp từ mới hoặc cải thiện định nghĩa hiện có</li>
          <li>Tham gia thảo luận cùng cộng đồng</li>
        </ul>`,
      )}
      ${ctaButton(`${process.env.CLIENT_URL}`, " Khám phá ngay", "#2563eb")}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Chào mừng đến với  UTB OpenDict!",
      html: buildEmailHtml("Chào mừng bạn!", "#2563eb", body),
    });
    console.log(`[Email] Welcome sent  ${userEmail}`);
  } catch (error) {
    // Non-critical — do not rethrow
    console.error("[Email] sendWelcomeEmail error:", error);
  }
};

/**
 * Gửi email đặt lại mật khẩu.
 */
exports.sendPasswordResetEmail = async (userEmail, userName, resetUrl) => {
  try {
    const { transporter, from } = await getMailConfig();

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
        Nhấn nút bên dưới để tạo mật khẩu mới.
      </p>
      ${ctaButton(resetUrl, " Đặt lại mật khẩu", "#7c3aed")}
      ${fallbackLink(resetUrl)}
      ${infoBox(
        "#fef2f2",
        "#ef4444",
        `
        <p style="margin:0;color:#991b1b;font-size:13px;">
           Liên kết này có hiệu lực trong <strong>30 phút</strong>.
          Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
        </p>`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Đặt lại mật khẩu — OpenDict",
      html: buildEmailHtml("Đặt lại mật khẩu", "#7c3aed", body),
    });
    console.log(`[Email] PasswordReset sent ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendPasswordResetEmail error:", error);
    throw new Error(
      "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.",
    );
  }
};

/**
 * Gửi email thông báo đóng góp được phê duyệt.
 */
exports.sendContributionApprovedEmail = async (
  userEmail,
  userName,
  contributionData,
) => {
  try {
    if (!(await isEmailNotificationEnabled(userEmail, "contributions"))) {
      console.log(
        `[Email] ContributionApproved skipped (notifications off) → ${userEmail}`,
      );
      return;
    }
    const { transporter, from } = await getMailConfig();
    const typeLabel =
      contributionData.type === "new_term"
        ? "Thêm từ mới"
        : contributionData.type === "edit_term"
          ? "Chỉnh sửa từ"
          : "Đóng góp";

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Đóng góp của bạn đã được <strong>phê duyệt</strong> thành công.
        Cảm ơn bạn đã đóng góp cho cộng đồng!
      </p>
      ${infoBox(
        "#f0fdf4",
        "#16a34a",
        `
        <p style="margin:0 0 6px;font-weight:700;color:#166534;font-size:14px;"> Thông tin đóng góp</p>
        <p style="margin:4px 0;color:#166534;font-size:14px;"><strong>Loại:</strong> ${typeLabel}</p>
        ${
          contributionData.termName
            ? `<p style="margin:4px 0;color:#166534;font-size:14px;"><strong>Thuật ngữ:</strong> ${contributionData.termName}</p>`
            : ""
        }
        ${
          contributionData.moderatorNote
            ? `<p style="margin:4px 0;color:#166534;font-size:14px;"><strong>Ghi chú kiểm duyệt:</strong> ${contributionData.moderatorNote}</p>`
            : ""
        }`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Đóng góp của bạn đã được phê duyệt ",
      html: buildEmailHtml("Đóng góp được phê duyệt", "#16a34a", body),
    });
    console.log(`[Email] ContributionApproved sent  ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendContributionApprovedEmail error:", error);
  }
};

/**
 * Gửi email thông báo đóng góp bị từ chối.
 */
exports.sendContributionRejectedEmail = async (
  userEmail,
  userName,
  contributionData,
) => {
  try {
    if (!(await isEmailNotificationEnabled(userEmail, "contributions"))) {
      console.log(
        `[Email] ContributionRejected skipped (notifications off) → ${userEmail}`,
      );
      return;
    }
    const { transporter, from } = await getMailConfig();
    const typeLabel =
      contributionData.type === "new_term"
        ? "Thêm từ mới"
        : contributionData.type === "edit_term"
          ? "Chỉnh sửa từ"
          : "Đóng góp";

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Đóng góp của bạn <strong>chưa được chấp nhận</strong> lần này.
        Bạn có thể xem xét lại và gửi đóng góp mới với nội dung phù hợp hơn.
      </p>
      ${infoBox(
        "#fff7ed",
        "#f97316",
        `
        <p style="margin:0 0 6px;font-weight:700;color:#9a3412;font-size:14px;">Thông tin đóng góp</p>
        <p style="margin:4px 0;color:#9a3412;font-size:14px;"><strong>Loại:</strong> ${typeLabel}</p>
        ${
          contributionData.termName
            ? `<p style="margin:4px 0;color:#9a3412;font-size:14px;"><strong>Thuật ngữ:</strong> ${contributionData.termName}</p>`
            : ""
        }
        ${
          contributionData.moderatorNote
            ? `<p style="margin:4px 0;color:#9a3412;font-size:14px;"><strong>Lý do từ chối:</strong> ${contributionData.moderatorNote}</p>`
            : ""
        }`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Đóng góp của bạn chưa được chấp nhận",
      html: buildEmailHtml("Đóng góp chưa được chấp nhận", "#f97316", body),
    });
    console.log(`[Email] ContributionRejected sent → ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendContributionRejectedEmail error:", error);
  }
};

/**
 * Gửi thông báo tới admin / moderator khi có đóng góp mới.
 */
exports.sendNewContributionNotificationToAdmins = async (
  contributionData,
  contributor,
) => {
  try {
    const User = require("../models/User");
    const admins = await User.find({
      role: { $in: ["admin", "moderator"] },
      status: "active",
      emailVerified: true,
      "emailNotifications.moderation": { $ne: false },
    }).select("email fullName");

    if (!admins.length) {
      console.log("[Email] No admins to notify");
      return;
    }

    const { transporter, from } = await getMailConfig();
    const typeLabel =
      contributionData.type === "new_term" ? "Thêm từ mới" : "Chỉnh sửa từ";

    for (const admin of admins) {
      const body = `
        ${greeting(admin.fullName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Có một đóng góp mới cần được kiểm duyệt.
        </p>
        ${infoBox(
          "#eff6ff",
          "#3b82f6",
          `
          <p style="margin:0 0 6px;font-weight:700;color:#1e40af;font-size:14px;"> Thông tin đóng góp</p>
          <p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Người đóng góp:</strong> ${contributor.fullName} (${contributor.email})</p>
          <p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Loại:</strong> ${typeLabel}</p>
          ${
            contributionData.term.vi ||
            contributionData.term.en ||
            contributionData.termName
              ? `<p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Thuật ngữ:</strong> ${contributionData.term.vi || contributionData.term.en || contributionData.termName}</p>`
              : ""
          }
          ${
            contributionData.definition.vi ||
            contributionData.definition.en ||
            contributionData.definition.lo
              ? `<p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Định nghĩa:</strong> ${contributionData.definition.vi || contributionData.definition.en || contributionData.definition.lo.substring(0, 120)}…</p>`
              : ""
          }`,
        )}
        ${ctaButton(
          `${process.env.CLIENT_URL}/admin/moderation/contributions`,
          " Kiểm duyệt ngay",
          "#2563eb",
        )}
        ${signOff()}`;

      await transporter.sendMail({
        from,
        to: admin.email,
        subject: " Có đóng góp mới cần kiểm duyệt",
        html: buildEmailHtml("Đóng góp mới cần kiểm duyệt", "#2563eb", body),
      });
    }

    console.log(
      `[Email] NewContribution notification sent → ${admins.length} admins`,
    );
  } catch (error) {
    console.error(
      "[Email] sendNewContributionNotificationToAdmins error:",
      error,
    );
  }
};

/**
 * Gửi thông báo tới admin / moderator khi có báo cáo mới.
 */
exports.sendNewReportNotificationToAdmins = async (
  reportData,
  reporter,
  reportedContent,
) => {
  try {
    const User = require("../models/User");
    const admins = await User.find({
      role: { $in: ["admin", "moderator"] },
      status: "active",
      emailVerified: true,
      "emailNotifications.moderation": { $ne: false },
    }).select("email fullName");

    if (!admins.length) {
      console.log("[Email] No admins to notify");
      return;
    }

    const { transporter, from } = await getMailConfig();
    const contentTypeLabel =
      reportData.contentType === "term"
        ? "Từ vựng"
        : reportData.contentType === "comment"
          ? "Bình luận"
          : "Khác";

    for (const admin of admins) {
      const body = `
        ${greeting(admin.fullName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Có một báo cáo mới từ người dùng cần được xử lý.
        </p>
        ${infoBox(
          "#fef2f2",
          "#ef4444",
          `
          <p style="margin:0 0 6px;font-weight:700;color:#991b1b;font-size:14px;"> Thông tin báo cáo</p>
          <p style="margin:4px 0;color:#991b1b;font-size:14px;"><strong>Người báo cáo:</strong> ${reporter.fullName} (${reporter.email})</p>
          <p style="margin:4px 0;color:#991b1b;font-size:14px;"><strong>Loại nội dung:</strong> ${contentTypeLabel}</p>
          <p style="margin:4px 0;color:#991b1b;font-size:14px;"><strong>Lý do:</strong> ${reportData.reason}</p>
          ${
            reportData.description
              ? `<p style="margin:4px 0;color:#991b1b;font-size:14px;"><strong>Mô tả:</strong> ${String(reportData.description).substring(0, 120)}…</p>`
              : ""
          }`,
        )}
        ${ctaButton(`${process.env.CLIENT_URL}/admin/moderation`, " Xử lý ngay", "#dc2626")}
        ${signOff()}`;

      await transporter.sendMail({
        from,
        to: admin.email,
        subject: "Có báo cáo mới cần xử lý",
        html: buildEmailHtml("Báo cáo mới cần xử lý", "#dc2626", body),
      });
    }

    console.log(
      `[Email] NewReport notification sent → ${admins.length} admins`,
    );
  } catch (error) {
    console.error("[Email] sendNewReportNotificationToAdmins error:", error);
  }
};

/**
 * Gửi email kết quả xử lý báo cáo cho người báo cáo.
 */
exports.sendReportResolvedEmail = async (userEmail, userName, reportData) => {
  try {
    if (!(await isEmailNotificationEnabled(userEmail, "moderation"))) {
      console.log(
        `[Email] ReportResolved skipped (notifications off) → ${userEmail}`,
      );
      return;
    }
    const { transporter, from } = await getMailConfig();
    const isResolved = reportData.status === "resolved";
    const statusLabel = isResolved ? "Đã xử lý" : "Đã đóng";
    const accentColor = isResolved ? "#16a34a" : "#64748b";

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Báo cáo của bạn đã được xử lý.
        Cảm ơn bạn đã giúp chúng tôi cải thiện chất lượng nội dung.
      </p>
      ${infoBox(
        "#f8fafc",
        "#94a3b8",
        `
        <p style="margin:0 0 6px;font-weight:700;color:#334155;font-size:14px;"> Kết quả xử lý</p>
        <p style="margin:4px 0;color:#334155;font-size:14px;"><strong>Trạng thái:</strong> ${statusLabel}</p>
        ${
          reportData.moderatorNote
            ? `<p style="margin:4px 0;color:#334155;font-size:14px;"><strong>Ghi chú:</strong> ${reportData.moderatorNote}</p>`
            : ""
        }`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: "Báo cáo của bạn đã được xử lý",
      html: buildEmailHtml("Kết quả xử lý báo cáo", accentColor, body),
    });
    console.log(`[Email] ReportResolved sent → ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendReportResolvedEmail error:", error);
  }
};

/**
 * Gửi email thông báo kết quả kiểm duyệt bình luận.
 */
exports.sendCommentModeratedEmail = async (
  userEmail,
  userName,
  commentData,
) => {
  try {
    if (!(await isEmailNotificationEnabled(userEmail, "moderation"))) {
      console.log(
        `[Email] CommentModerated skipped (notifications off) → ${userEmail}`,
      );
      return;
    }
    const { transporter, from } = await getMailConfig();
    const isApproved = commentData.status === "approved";
    const accentColor = isApproved ? "#16a34a" : "#f97316";
    const statusLabel = isApproved ? "được duyệt " : "bị từ chối ";
    const boxBg = isApproved ? "#f0fdf4" : "#fff7ed";
    const textColor = isApproved ? "#166534" : "#9a3412";

    const preview = commentData.commentContent
      ? String(commentData.commentContent).substring(0, 200) +
        (commentData.commentContent.length > 200 ? "…" : "")
      : "";

    const body = `
      ${greeting(userName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Bình luận của bạn đã <strong>${statusLabel}</strong>.
      </p>
      ${infoBox(
        boxBg,
        accentColor,
        `
        <p style="margin:0 0 6px;font-weight:700;color:${textColor};font-size:14px;"> Chi tiết bình luận</p>
        <p style="margin:4px 0;color:${textColor};font-size:14px;"><strong>Thuật ngữ:</strong> ${commentData.termName}</p>
        ${
          preview
            ? `<p style="margin:4px 0;color:${textColor};font-size:14px;"><strong>Nội dung:</strong> ${preview}</p>`
            : ""
        }
        ${
          commentData.moderatorNote
            ? `<p style="margin:4px 0;color:${textColor};font-size:14px;"><strong>Ghi chú:</strong> ${commentData.moderatorNote}</p>`
            : ""
        }`,
      )}
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:12px 0 0;">
        ${
          isApproved
            ? "Cảm ơn bạn đã đóng góp cho cộng đồng! 🎉"
            : "Bạn có thể chỉnh sửa và gửi lại bình luận với nội dung phù hợp hơn."
        }
      </p>
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: `Bình luận của bạn đã ${statusLabel}`,
      html: buildEmailHtml(`Bình luận ${statusLabel}`, accentColor, body),
    });
    console.log(`[Email] CommentModerated sent → ${userEmail}`);
  } catch (error) {
    console.error("[Email] sendCommentModeratedEmail error:", error);
  }
};

/**
 * Gửi thông báo tới moderator được phân công và admin khi có nội dung mới cần duyệt.
 */
exports.sendNewContentNotificationToModerators = async (
  contentType,
  contentData,
  contributor,
  categoryId,
) => {
  try {
    const User = require("../models/User");
    const [moderators, admins] = await Promise.all([
      User.find({
        role: "moderator",
        status: "active",
        "moderationPermissions.categories": categoryId,
        "emailNotifications.moderation": { $ne: false },
      }).select("email fullName"),
      User.find({
        role: "admin",
        status: "active",
        "emailNotifications.moderation": { $ne: false },
      }).select("email fullName"),
    ]);

    const allRecipients = [...moderators, ...admins];
    if (!allRecipients.length) {
      console.log("[Email] No moderators/admins to notify");
      return;
    }

    const { transporter, from } = await getMailConfig();
    const typeLabel =
      { contribution: "Đóng góp", comment: "Bình luận", report: "Báo cáo" }[
        contentType
      ] || "Nội dung";

    for (const recipient of allRecipients) {
      const body = `
        ${greeting(recipient.fullName)}
        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Có <strong>${typeLabel.toLowerCase()}</strong> mới từ người dùng
          <strong>${contributor?.fullName || "Ẩn danh"}</strong> cần được kiểm duyệt.
        </p>
        ${infoBox(
          "#eff6ff",
          "#3b82f6",
          `
          <p style="margin:0 0 6px;font-weight:700;color:#1e40af;font-size:14px;">📋 Chi tiết</p>
          ${
            contentData.termName
              ? `<p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Thuật ngữ:</strong> ${contentData.termName}</p>`
              : ""
          }
          ${
            contentData.content
              ? `<p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Nội dung:</strong> ${String(contentData.content).substring(0, 200)}…</p>`
              : ""
          }
          ${
            contentData.reason
              ? `<p style="margin:4px 0;color:#1e40af;font-size:14px;"><strong>Lý do:</strong> ${contentData.reason}</p>`
              : ""
          }`,
        )}
        ${ctaButton(`${process.env.CLIENT_URL}/admin/moderation`, " Kiểm duyệt ngay", "#2563eb")}
        ${signOff()}`;

      await transporter.sendMail({
        from,
        to: recipient.email,
        subject: `${typeLabel} mới cần kiểm duyệt`,
        html: buildEmailHtml(
          `${typeLabel} mới cần kiểm duyệt`,
          "#2563eb",
          body,
        ),
      });
    }

    console.log(
      `[Email] New${contentType} notification sent → ${allRecipients.length} recipients`,
    );
  } catch (error) {
    console.error(
      "[Email] sendNewContentNotificationToModerators error:",
      error,
    );
  }
};

/**
 * Gửi email kết quả nhập dữ liệu cho Admin.
 */
exports.sendImportNotificationEmail = async (
  adminEmail,
  adminName,
  importData,
) => {
  try {
    if (!(await isEmailNotificationEnabled(adminEmail, "system"))) {
      console.log(
        `[Email] ImportNotification skipped (notifications off) → ${adminEmail}`,
      );
      return;
    }
    const { transporter, from } = await getMailConfig();

    const errorsHtml =
      importData.errors && importData.errors.length > 0
        ? `<p style="margin:8px 0 4px;font-weight:700;color:#991b1b;font-size:13px;">Danh sách lỗi:</p>
           <ul style="margin:0;padding-left:18px;color:#991b1b;font-size:13px;line-height:1.6;">
             ${importData.errors
               .slice(0, 5)
               .map((e) => `<li>${e}</li>`)
               .join("")}
           </ul>`
        : "";

    const body = `
      ${greeting(adminName)}
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Quá trình nhập dữ liệu từ file <strong>${importData.fileName}</strong> đã hoàn tất.
      </p>
      ${infoBox(
        "#f8fafc",
        "#64748b",
        `
        <p style="margin:0 0 8px;font-weight:700;color:#334155;font-size:14px;">📊 Kết quả nhập dữ liệu</p>
        <p style="margin:4px 0;color:#334155;font-size:14px;"><strong>Tổng số bản ghi:</strong> ${importData.total}</p>
        <p style="margin:4px 0;color:#16a34a;font-size:14px;"><strong>Thành công:</strong> ${importData.success}</p>
        <p style="margin:4px 0;color:#dc2626;font-size:14px;"><strong>Thất bại:</strong> ${importData.failed}</p>
        ${errorsHtml}`,
      )}
      ${signOff()}`;

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: "Kết quả nhập dữ liệu — OpenDict",
      html: buildEmailHtml("Kết quả nhập dữ liệu", "#64748b", body),
    });
    console.log(`[Email] ImportNotification sent → ${adminEmail}`);
  } catch (error) {
    console.error("[Email] sendImportNotificationEmail error:", error);
  }
};

/**
 * Kiểm tra cấu hình email (SMTP verify).
 */
exports.testEmailConfiguration = async () => {
  try {
    const { transporter } = await getMailConfig();
    await transporter.verify();
    return { success: true, message: "Email configuration is valid" };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
