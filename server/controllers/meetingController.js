const Meeting = require("../models/Meeting");
const mammoth = require("mammoth");
const PDFParser = require("pdf2json");
const path = require("path");

const parsePdfBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(new Error(errData.parserError || "Failed to parse PDF"));
    });
    
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        let text = "";
        if (pdfData && pdfData.Pages) {
          pdfData.Pages.forEach((page) => {
            if (page && page.Texts) {
              page.Texts.forEach((textRun) => {
                if (textRun && textRun.R && textRun.R[0]) {
                  text += decodeURIComponent(textRun.R[0].T) + " ";
                }
              });
              text += "\n";
            }
          });
        }
        resolve(text.trim());
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
};

exports.createMeeting = async (req, res) => {
  try {
    let { title, transcriptText } = req.body;
    let rawTranscript = "";
    let source = "paste";

    if (req.file) {
      source = "upload";
      const file = req.file;

      if (!title) {
        title = path.basename(file.originalname, path.extname(file.originalname));
      }

      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === ".txt") {
        rawTranscript = file.buffer.toString("utf-8");
      } else if (ext === ".docx") {
        const mammothResult = await mammoth.extractRawText({ buffer: file.buffer });
        rawTranscript = mammothResult.value;
      } else if (ext === ".pdf") {
        rawTranscript = await parsePdfBuffer(file.buffer);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Only .txt, .docx, and .pdf are allowed." });
      }
    } else {
      if (!title || !transcriptText) {
        return res.status(400).json({ error: "Title and transcript text are required." });
      }
      rawTranscript = transcriptText;
    }

    if (!rawTranscript || !rawTranscript.trim()) {
      return res.status(400).json({ error: "Transcript content cannot be empty." });
    }

    const meeting = new Meeting({
      title,
      rawTranscript: rawTranscript.trim(),
      source,
      status: "uploaded",
      owner: req.user.id,
    });

    const savedMeeting = await meeting.save();
    res.status(201).json(savedMeeting);
  } catch (error) {
    console.error("Create Meeting Error:", error);
    res.status(500).json({ error: "Failed to create meeting entry: " + error.message });
  }
};

exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You do not own this meeting registry entry." });
    }

    res.json(meeting);
  } catch (error) {
    console.error("Get Meeting Error:", error);
    res.status(500).json({ error: "Internal Server Error fetching meeting entry." });
  }
};
