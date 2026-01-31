const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { USER_ROLES, MODERATION_PERMISSIONS } = require("../utils/constants");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minLength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false,
    },
    fullName: {
      type: String,
      required: [true, "Họ và tên là bắt buộc"],
      trim: true,
      maxLength: [50, "Họ và tên không được vượt quá 50 ký tự"],
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    preferredLanguage: {
      type: String,
      enum: ["en", "vi", "lo"],
      default: "vi",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    contributionCount: {
      type: Number,
      default: 0,
    },
    lastLogin: Date,
    // Moderation permissions for moderators
    moderationPermissions: {
      categories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      permissions: [
        {
          type: String,
          enum: Object.values(MODERATION_PERMISSIONS),
        },
      ],
    },
  },
  { timestamps: true },
);
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (cadidatePassword) {
  return await bcrypt.compare(cadidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
