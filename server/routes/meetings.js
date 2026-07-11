const express = require("express");
const router = express.Router();
const multer = require("multer");
const meetingController = require("../controllers/meetingController");

const storage = multer.memoryStorage();
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
router.put("/:id", meetingController.updateMeeting);

module.exports = router;
