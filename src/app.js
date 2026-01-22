const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const errorHandler = require("./middlewares/errorHandler");

// Import routes
const authRoutes = require("./routes/authRoutes");
const termRoutes = require("./routes/termRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const commentRoutes = require("./routes/commentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const userRoutes = require("./routes/userRoutes");
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/terms", termRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/import", importRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Error handler
app.use(errorHandler);

module.exports = app;
