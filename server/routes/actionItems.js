const express = require("express");
const router = express.Router();
const meetingController = require("../controllers/meetingController");

router.get("/", meetingController.getActionItems);
router.patch("/:meetingId/:itemId", meetingController.updateActionItemStatus);
router.post("/:itemId/export", meetingController.exportActionItem);

module.exports = router;
