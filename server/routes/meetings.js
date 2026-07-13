const express = require("express");
const router = express.Router();
const multer = require("multer");
const meetingController = require("../controllers/meetingController");
const ragController = require("../controllers/ragController");

const os = require("os");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) =>
    cb(
      null,
      `audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
        file.originalname
      )}`
    ),
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /txt|docx|pdf|mp3|m4a|wav/i;
    const extname = filetypes.test(file.originalname.split(".").pop());
    if (extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "File upload only supports .txt, .docx, .pdf, .mp3, .m4a, and .wav files."
      )
    );
  },
});

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, meetingController.createMeeting);

router.get("/", meetingController.getMeetings);
router.get("/:id", meetingController.getMeetingById);
router.post("/:id/transcribe", meetingController.transcribeMeeting);
router.post("/:id/process", meetingController.processMeeting);
router.post("/:id/export-all", meetingController.exportAllActionItems);
router.put("/:id", meetingController.updateMeeting);

// RAG Q&A Endpoints
router.post("/:id/index", ragController.retryIndexing);
router.post("/:id/ask", ragController.askQuestion);
router.get("/:id/qa-history", ragController.getQaHistory);

router.delete("/:id", meetingController.deleteMeeting);

module.exports = router;
