const Feedback = require("../models/Feedback");
const ModeratorApplication = require("../models/ModeratorApplication");
const User = require("../models/User");
const { sendSuccess, sendError } = require("../utils/response");

// === Public endpoints ===

exports.submitFeedback = async (req, res) => {
  try {
    const { name, email, type, message } = req.body;

    if (!name || !email || !message) {
      return sendError(res, "Vui lòng điền đầy đủ thông tin", 400);
    }

    const feedback = await Feedback.create({ name, email, type, message });

    return sendSuccess(
      res,
      { id: feedback._id },
      "Gửi phản hồi thành công",
      201,
    );
  } catch (error) {
    console.error("Submit feedback error:", error);
    return sendError(res, "Không thể gửi phản hồi", 500);
  }
};

exports.submitModeratorApplication = async (req, res) => {
  try {
    const { name, email, reason, experience } = req.body;

    if (!name || !email || !reason) {
      return sendError(res, "Vui lòng điền đầy đủ thông tin", 400);
    }

    // Check duplicate pending application
    const existing = await ModeratorApplication.findOne({
      email,
      status: "pending",
    });
    if (existing) {
      return sendError(res, "Bạn đã có đơn đăng ký đang chờ xử lý", 400);
    }

    const application = await ModeratorApplication.create({
      name,
      email,
      reason,
      experience,
    });

    return sendSuccess(
      res,
      { id: application._id },
      "Gửi đăng ký thành công",
      201,
    );
  } catch (error) {
    console.error("Submit moderator application error:", error);
    return sendError(res, "Không thể gửi đăng ký", 500);
  }
};

// === Admin endpoints ===

exports.getFeedbacks = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const feedbacks = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments(filter);

    return sendSuccess(res, {
      feedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get feedbacks error:", error);
    return sendError(res, "Không thể lấy danh sách phản hồi", 500);
  }
};

exports.updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status, adminNote },
      { new: true },
    );

    if (!feedback) {
      return sendError(res, "Không tìm thấy phản hồi", 404);
    }

    return sendSuccess(res, feedback, "Cập nhật thành công");
  } catch (error) {
    console.error("Update feedback error:", error);
    return sendError(res, "Không thể cập nhật", 500);
  }
};

exports.getModeratorApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const applications = await ModeratorApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ModeratorApplication.countDocuments(filter);

    return sendSuccess(res, {
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get moderator applications error:", error);
    return sendError(res, "Không thể lấy danh sách đơn đăng ký", 500);
  }
};

exports.reviewModeratorApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return sendError(res, "Trạng thái không hợp lệ", 400);
    }

    const application = await ModeratorApplication.findById(id);
    if (!application) {
      return sendError(res, "Không tìm thấy đơn đăng ký", 404);
    }

    application.status = status;
    application.adminNote = adminNote || "";
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // If approved, update user role to moderator
    if (status === "approved") {
      const user = await User.findOne({ email: application.email });
      if (user && user.role === "user") {
        user.role = "moderator";
        await user.save();
      }
    }

    return sendSuccess(res, application, "Xử lý đơn đăng ký thành công");
  } catch (error) {
    console.error("Review moderator application error:", error);
    return sendError(res, "Không thể xử lý đơn đăng ký", 500);
  }
};
