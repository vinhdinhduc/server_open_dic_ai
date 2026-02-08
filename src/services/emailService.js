const nodemailer = require("nodemailer");
const SystemConfig = require("../models/SystemConfig");

/**
 * Lấy email transporter từ config
 */
const getEmailTransporter = async () => {
  const emailService = await SystemConfig.getValue("email_service", "gmail");
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
  const emailFrom = await SystemConfig.getValue(
    "email_from",
    process.env.EMAIL_FROM || emailUser,
  );

  if (!emailUser || !emailPassword) {
    throw new Error("Email configuration is missing");
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailSecure,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

/**
 * Gửi email chào mừng khi đăng ký
 */
exports.sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    const mailOptions = {
      from: emailFrom,
      to: userEmail,
      subject: "Chào mừng bạn đến với Từ điển Mở!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Xin chào ${userName}!</h2>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Từ điển Mở</strong>.</p>
          <p>Bạn có thể bắt đầu:</p>
          <ul>
            <li>Tra cứu từ vựng</li>
            <li>Đóng góp từ mới</li>
            <li>Tham gia cộng đồng xây dựng từ điển</li>
          </ul>
          <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi.</p>
          <p style="margin-top: 30px;">Trân trọng,<br/>Đội ngũ Từ điển Mở</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Không throw error để không làm gián đoạn quá trình đăng ký
  }
};

/**
 * Gửi email thông báo cho user khi đóng góp được duyệt
 */
exports.sendContributionApprovedEmail = async (
  userEmail,
  userName,
  contributionData,
) => {
  try {
    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    const mailOptions = {
      from: emailFrom,
      to: userEmail,
      subject: "Đóng góp của bạn đã được phê duyệt",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Chúc mừng ${userName}!</h2>
          <p>Đóng góp của bạn đã được phê duyệt thành công.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Thông tin đóng góp:</h3>
            <p><strong>Loại:</strong> ${contributionData.type === "new" ? "Thêm từ mới" : contributionData.type === "edit" ? "Chỉnh sửa từ" : "Báo cáo lỗi"}</p>
            ${contributionData.termName ? `<p><strong>Từ:</strong> ${contributionData.termName}</p>` : ""}
            ${contributionData.moderatorNote ? `<p><strong>Ghi chú:</strong> ${contributionData.moderatorNote}</p>` : ""}
          </div>
          <p>Cảm ơn bạn đã đóng góp vào việc xây dựng Từ điển Mở!</p>
          <p style="margin-top: 30px;">Trân trọng,<br/>Đội ngũ Từ điển Mở</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Contribution approved email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending contribution approved email:", error);
  }
};

/**
 * Gửi email thông báo cho user khi đóng góp bị từ chối
 */
exports.sendContributionRejectedEmail = async (
  userEmail,
  userName,
  contributionData,
) => {
  try {
    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    const mailOptions = {
      from: emailFrom,
      to: userEmail,
      subject: "Đóng góp của bạn chưa được chấp nhận",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">Xin chào ${userName},</h2>
          <p>Đóng góp của bạn chưa được chấp nhận.</p>
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF9800;">
            <h3 style="margin-top: 0;">Thông tin đóng góp:</h3>
            <p><strong>Loại:</strong> ${contributionData.type === "new" ? "Thêm từ mới" : contributionData.type === "edit" ? "Chỉnh sửa từ" : "Báo cáo lỗi"}</p>
            ${contributionData.termName ? `<p><strong>Từ:</strong> ${contributionData.termName}</p>` : ""}
            ${contributionData.moderatorNote ? `<p><strong>Lý do:</strong> ${contributionData.moderatorNote}</p>` : ""}
          </div>
          <p>Bạn có thể xem xét và gửi lại đóng góp với nội dung phù hợp hơn.</p>
          <p style="margin-top: 30px;">Trân trọng,<br/>Đội ngũ Từ điển Mở</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Contribution rejected email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending contribution rejected email:", error);
  }
};

/**
 * Gửi email thông báo cho admin khi có đóng góp mới
 */
exports.sendNewContributionNotificationToAdmins = async (
  contributionData,
  contributor,
) => {
  try {
    const User = require("../models/User");

    // Lấy danh sách admin và moderator
    const admins = await User.find({
      role: { $in: ["admin", "moderator"] },
      status: "active",
      emailVerified: true,
    }).select("email fullName");

    if (admins.length === 0) {
      console.log("No admins to notify");
      return;
    }

    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    for (const admin of admins) {
      const mailOptions = {
        from: emailFrom,
        to: admin.email,
        subject: "Có đóng góp mới cần kiểm duyệt",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2196F3;">Đóng góp mới cần kiểm duyệt</h2>
            <p>Xin chào ${admin.fullName},</p>
            <p>Có một đóng góp mới từ người dùng cần được kiểm duyệt.</p>
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3;">
              <h3 style="margin-top: 0;">Thông tin đóng góp:</h3>
              <p><strong>Người đóng góp:</strong> ${contributor.fullName} (${contributor.email})</p>
              <p><strong>Loại:</strong> ${contributionData.type === "new" ? "Thêm từ mới" : contributionData.type === "edit" ? "Chỉnh sửa từ" : "Báo cáo lỗi"}</p>
              ${contributionData.term ? `<p><strong>Từ:</strong> ${contributionData.term}</p>` : ""}
              ${contributionData.definition ? `<p><strong>Định nghĩa:</strong> ${contributionData.definition.substring(0, 100)}...</p>` : ""}
            </div>
            <p>Vui lòng đăng nhập vào hệ thống để kiểm duyệt đóng góp này.</p>
            <p style="margin-top: 30px;">Trân trọng,<br/>Hệ thống Từ điển Mở</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    console.log(
      `New contribution notification sent to ${admins.length} admins`,
    );
  } catch (error) {
    console.error("Error sending admin notification:", error);
  }
};

/**
 * Gửi email thông báo cho admin khi có báo cáo mới
 */
exports.sendNewReportNotificationToAdmins = async (
  reportData,
  reporter,
  reportedContent,
) => {
  try {
    const User = require("../models/User");

    // Lấy danh sách admin và moderator
    const admins = await User.find({
      role: { $in: ["admin", "moderator"] },
      status: "active",
      emailVerified: true,
    }).select("email fullName");

    if (admins.length === 0) {
      console.log("No admins to notify");
      return;
    }

    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    for (const admin of admins) {
      const mailOptions = {
        from: emailFrom,
        to: admin.email,
        subject: "Có báo cáo mới cần xử lý",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f44336;">Báo cáo mới cần xử lý</h2>
            <p>Xin chào ${admin.fullName},</p>
            <p>Có một báo cáo mới từ người dùng cần được xử lý.</p>
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
              <h3 style="margin-top: 0;">Thông tin báo cáo:</h3>
              <p><strong>Người báo cáo:</strong> ${reporter.fullName} (${reporter.email})</p>
              <p><strong>Loại nội dung:</strong> ${reportData.contentType === "term" ? "Từ vựng" : reportData.contentType === "comment" ? "Bình luận" : "Khác"}</p>
              <p><strong>Lý do:</strong> ${reportData.reason}</p>
              ${reportData.description ? `<p><strong>Mô tả:</strong> ${reportData.description.substring(0, 100)}...</p>` : ""}
            </div>
            <p>Vui lòng đăng nhập vào hệ thống để xử lý báo cáo này.</p>
            <p style="margin-top: 30px;">Trân trọng,<br/>Hệ thống Từ điển Mở</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    console.log(`New report notification sent to ${admins.length} admins`);
  } catch (error) {
    console.error("Error sending report notification:", error);
  }
};

/**
 * Gửi email thông báo kết quả xử lý báo cáo cho người báo cáo
 */
exports.sendReportResolvedEmail = async (userEmail, userName, reportData) => {
  try {
    const transporter = await getEmailTransporter();
    const emailFrom = await SystemConfig.getValue(
      "email_from",
      process.env.EMAIL_FROM,
    );

    const mailOptions = {
      from: emailFrom,
      to: userEmail,
      subject: "Báo cáo của bạn đã được xử lý",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Xin chào ${userName},</h2>
          <p>Báo cáo của bạn đã được xử lý.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Thông tin xử lý:</h3>
            <p><strong>Trạng thái:</strong> ${reportData.status === "resolved" ? "Đã xử lý" : "Đã đóng"}</p>
            ${reportData.moderatorNote ? `<p><strong>Ghi chú:</strong> ${reportData.moderatorNote}</p>` : ""}
          </div>
          <p>Cảm ơn bạn đã giúp chúng tôi cải thiện chất lượng nội dung.</p>
          <p style="margin-top: 30px;">Trân trọng,<br/>Đội ngũ Từ điển Mở</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Report resolved email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending report resolved email:", error);
  }
};

/**
 * Kiểm tra cấu hình email
 */
exports.testEmailConfiguration = async () => {
  try {
    const transporter = await getEmailTransporter();
    await transporter.verify();
    return { success: true, message: "Email configuration is valid" };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
