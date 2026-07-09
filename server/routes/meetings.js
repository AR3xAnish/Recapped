const express = require("express");
const router = express.Router();
const multer = require("multer");
const meetingController = require("../controllers/meetingController");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /txt|docx|pdf/i;
    const extname = filetypes.test(file.originalname.split(".").pop());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error("File upload only supports .txt, .docx, and .pdf files."));
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

router.get("/:id", meetingController.getMeetingById);

module.exports = router;
