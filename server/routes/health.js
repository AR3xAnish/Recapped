const express = require("express");
const router = express.Router();

// @route   GET /api/health
// @desc    Basic health check
// @access  Public
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
