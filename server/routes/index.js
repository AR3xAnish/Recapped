const express = require("express");
const router = express.Router();
const healthRouter = require("./health");
const authRouter = require("./auth");
const meetingsRouter = require("./meetings");
const auth = require("../middleware/auth");

// Public routes
router.use("/", healthRouter);
router.use("/auth", authRouter);

// Apply auth middleware to all subsequent routes
router.use(auth);

// Protected routes
router.use("/meetings", meetingsRouter);
router.get("/protected-test", (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});

module.exports = router;
