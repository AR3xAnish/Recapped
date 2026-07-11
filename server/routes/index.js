const express = require("express");
const router = express.Router();
const healthRouter = require("./health");
const authRouter = require("./auth");
const meetingsRouter = require("./meetings");
const actionItemsRouter = require("./actionItems");
const integrationsRouter = require("./integrations");
const integrationController = require("../controllers/integrationController");
const auth = require("../middleware/auth");

// Public routes
router.use("/", healthRouter);
router.use("/auth", authRouter);
router.get("/integrations/notion/callback", integrationController.notionCallback);

// Apply auth middleware to all subsequent routes
router.use(auth);

// Protected routes
router.use("/meetings", meetingsRouter);
router.use("/action-items", actionItemsRouter);
router.use("/integrations", integrationsRouter);
router.get("/protected-test", (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});

module.exports = router;
