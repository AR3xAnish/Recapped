const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");

// Protected endpoints (registered after auth middleware)
router.post("/notion/connect", integrationController.connectNotion);
router.get("/notion/databases", integrationController.getNotionDatabases);
router.post("/notion/database", integrationController.setNotionDatabase);
router.delete("/notion/disconnect", integrationController.disconnectNotion);
router.get("/notion/status", integrationController.getNotionStatus);

module.exports = router;
