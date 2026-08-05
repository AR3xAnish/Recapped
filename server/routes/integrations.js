const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");

// Protected endpoints (registered after auth middleware)
router.post("/notion/connect", integrationController.connectNotion);
router.get("/notion/databases", integrationController.getNotionDatabases);
router.post("/notion/database", integrationController.setNotionDatabase);
router.delete("/notion/disconnect", integrationController.disconnectNotion);
router.get("/notion/status", integrationController.getNotionStatus);

// Slack integration endpoints
router.post("/slack/connect", integrationController.connectSlack);
router.get("/slack/channels", integrationController.getSlackChannels);
router.post("/slack/channel", integrationController.setSlackChannel);
router.delete("/slack/disconnect", integrationController.disconnectSlack);
router.get("/slack/status", integrationController.getSlackStatus);

module.exports = router;
