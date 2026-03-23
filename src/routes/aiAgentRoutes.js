const express = require("express");
const router = express.Router();
const aiAgentController = require("../controllers/aiAgentController");
const { authenticate } = require("../middlewares/auth");
const { aiLimiter, apiLimiter } = require("../middlewares/rateLimiter");

router.post("/chat", authenticate, aiLimiter, aiAgentController.chatWithAgent);

router.post("/suggestions", aiLimiter, aiAgentController.getSuggestions);

router.post(
  "/search-suggestions",
  aiLimiter,
  aiAgentController.getSearchSuggestions,
);

router.get(
  "/related-terms/:termId",
  aiLimiter,
  aiAgentController.getRelatedTerms,
);

router.get(
  "/suggested-categories",
  apiLimiter,
  aiAgentController.getSuggestedCategories,
);

router.post(
  "/search-keywords",
  apiLimiter,
  aiAgentController.suggestSearchKeywords,
);

router.post(
  "/contribution-recommendation",
  apiLimiter,
  aiAgentController.getContributionRecommendation,
);

// Endpoints cần xác thực
router.post(
  "/feedback",
  authenticate,
  apiLimiter,
  aiAgentController.provideFeedback,
);

router.post(
  "/contextual-actions",
  apiLimiter,
  aiAgentController.getContextualActions,
);

// AI-powered term identification, classification, and translation
router.post(
  "/identify-terms",
  authenticate,
  aiLimiter,
  aiAgentController.identifyTerms,
);

router.post(
  "/translate-term",
  authenticate,
  aiLimiter,
  aiAgentController.translateTerm,
);

router.post(
  "/term-taxonomy",
  authenticate,
  aiLimiter,
  aiAgentController.getTermTaxonomy,
);

module.exports = router;
