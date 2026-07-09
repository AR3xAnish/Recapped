const express = require("express");
const router = express.Router();
const healthRouter = require("./health");

// Register health routes
router.use("/", healthRouter);

module.exports = router;
