const { successResponse, errorResponse } = require("../utils/response");
const Comment = require("../models/Comment");

exports.createComment = async (req, res, next) => {
  try {
    const { termId, content, parent } = req.body;
    const userId = req.user._id;

    const comment = await Comment.create({
      term: termId,
      user: userId,
      content,
      parent,
    });

    await comment.populate("user", "username avatar");

    return successResponse(res, "Tạo bình luận thành công", comment, 201);
  } catch (error) {
    next(error);
  }
};

exports.getComments = async (req, res, next) => {
  try {
    const { termId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const comments = await Comment.find({
      term: termId,
      parent: null,
      isDeleted: false,
    })
      .populate("user", "username avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Comment.countDocuments({
      term: termId,
      parent: null,
      isDeleted: false,
    });

    return successResponse(res, "Lấy danh sách bình luận thành công", {
      comments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const comment = await Comment.findOne({ _id: id, user: userId });

    if (!comment) {
      return errorResponse(
        res,
        "Không tìm thấy bình luận hoặc không có quyền chỉnh sửa",
        404
      );
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    return successResponse(res, "Cập nhật bình luận thành công", comment);
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findOne({ _id: id, user: userId });

    if (!comment) {
      return errorResponse(
        res,
        "Không tìm thấy bình luận hoặc không có quyền xóa",
        404
      );
    }

    comment.isDeleted = true;
    await comment.save();

    return successResponse(res, "Xóa bình luận thành công");
  } catch (error) {
    next(error);
  }
};
