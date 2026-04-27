const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id: googleId, displayName, emails, photos } = profile;
        const email = emails && emails[0] ? emails[0].value : null;
        const avatar = photos && photos[0] ? photos[0].value : null;

        if (!email) {
          return done(new Error("Không thể lấy email từ Google"), null);
        }

        let user = await User.findOne({
          $or: [{ googleId }, { email }],
        });

        if (user) {
          if (user.status === "banned") {
            return done(new Error("Tài khoản của bạn đã bị khóa"), null);
          }

          if (!user.googleId) {
            user.googleId = googleId;
            user.authProvider = "google";
          }

          if (avatar && !user.avatar) {
            user.avatar = avatar;
          }

          user.emailVerified = true;
          if (user.status === "inactive") {
            user.status = "active";
          }
          user.lastLogin = Date.now();

          await user.save();
        } else {
          // Tạo người dùng mới
          user = await User.create({
            googleId,
            email,
            fullName: displayName,
            avatar,
            authProvider: "google",
            emailVerified: true,
            status: "active",
            lastLogin: Date.now(),
          });
        }

        // Return user to be serialized
        return done(null, user);
      } catch (error) {
        console.error("Google OAuth Strategy Error:", error);
        return done(error, null);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
