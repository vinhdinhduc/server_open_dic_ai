const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

/**
 * Passport Google OAuth 2.0 Strategy Configuration
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
      proxy: true, // Trust proxy for HTTPS callback URLs in production
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract user info from Google profile
        const { id: googleId, displayName, emails, photos } = profile;
        const email = emails && emails[0] ? emails[0].value : null;
        const avatar = photos && photos[0] ? photos[0].value : null;

        if (!email) {
          return done(new Error("Không thể lấy email từ Google"), null);
        }

        // Find existing user by googleId or email
        let user = await User.findOne({
          $or: [{ googleId }, { email }],
        });

        if (user) {
          // User exists - update information if needed
          if (user.status === "banned") {
            return done(new Error("Tài khoản của bạn đã bị khóa"), null);
          }

          // Update googleId if user registered with email first
          if (!user.googleId) {
            user.googleId = googleId;
            user.authProvider = "google";
          }

          // Update avatar if not set
          if (avatar && !user.avatar) {
            user.avatar = avatar;
          }

          // Update verification status
          user.emailVerified = true;
          if (user.status === "inactive") {
            user.status = "active";
          }
          user.lastLogin = Date.now();

          await user.save();
        } else {
          // Create new user
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

/**
 * Serialize user for session
 * Store only user ID in session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Deserialize user from session
 * Retrieve full user object from database
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
