const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/authorize");

// Public endpoints
router.post("/feedback", feedbackController.submitFeedback);
router.post(
  "/moderator-application",
  feedbackController.submitModeratorApplication,
);

// Admin endpoints
router.get("/feedback", authenticate, isAdmin, feedbackController.getFeedbacks);
router.put(
  "/feedback/:id",
  authenticate,
  isAdmin,
  feedbackController.updateFeedbackStatus,
);
router.get(
  "/moderator-applications",
  authenticate,
  isAdmin,
  feedbackController.getModeratorApplications,
);
router.put(
  "/moderator-applications/:id",
  authenticate,
  isAdmin,
  feedbackController.reviewModeratorApplication,
);

module.exports = router;
