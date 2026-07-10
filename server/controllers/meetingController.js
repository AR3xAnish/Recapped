const Meeting = require("../models/Meeting");
const mammoth = require("mammoth");
const PDFParser = require("pdf2json");
const path = require("path");
const { extractTranscript } = require("../services/agent/extract");
const { generateSummaryAndEmail } = require("../services/agent/summarize");

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

exports.processMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You do not own this meeting registry entry." });
    }

    if (meeting.status === "processing") {
      return res.status(400).json({ error: "This meeting registry entry is already being processed." });
    }

    meeting.status = "processing";
    meeting.processingError = undefined;
    await meeting.save();

    res.json({ message: "Meeting analysis started.", status: "processing" });

    // Run extraction asynchronously in background
    extractTranscript(meeting.rawTranscript)
      .then(async (result) => {
        const freshMeeting = await Meeting.findById(meeting._id);
        if (freshMeeting) {
          freshMeeting.participants = result.participants;
          freshMeeting.actionItems = result.actionItems.map((item) => ({
            ...item,
            status: "todo",
            meetingId: freshMeeting._id,
          }));
          freshMeeting.keyDecisions = result.keyDecisions;
          freshMeeting.status = "processed";
          freshMeeting.processingError = undefined;
          await freshMeeting.save();
          console.log(`[Agent] Meeting ${freshMeeting._id} extraction completed successfully.`);

          // Chain summary and email generation
          try {
            const summaryResult = await generateSummaryAndEmail(
              freshMeeting.rawTranscript,
              freshMeeting.participants,
              freshMeeting.actionItems,
              freshMeeting.keyDecisions
            );
            freshMeeting.summary = summaryResult.summary;
            freshMeeting.followUpEmail = summaryResult.followUpEmail;
            await freshMeeting.save();
            console.log(`[Agent] Meeting ${freshMeeting._id} summarization completed successfully.`);
          } catch (sumError) {
            console.error(`[Agent] Meeting ${freshMeeting._id} summarization failed:`, sumError);
          }
        }
      })
      .catch(async (error) => {
        const freshMeeting = await Meeting.findById(meeting._id);
        if (freshMeeting) {
          freshMeeting.status = "failed";
          freshMeeting.processingError = error.message || "Unknown analysis error.";
          await freshMeeting.save();
          console.error(`[Agent] Meeting ${freshMeeting._id} analysis failed:`, error);
        }
      });

  } catch (error) {
    console.error("Process Meeting Error:", error);
    res.status(500).json({ error: "Failed to trigger meeting analysis." });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You do not own this meeting registry entry." });
    }

    const { title, summary, followUpEmail } = req.body;

    if (title !== undefined) meeting.title = title;
    if (summary !== undefined) meeting.summary = summary;
    if (followUpEmail !== undefined) {
      meeting.followUpEmail = meeting.followUpEmail || {};
      if (followUpEmail.subject !== undefined) meeting.followUpEmail.subject = followUpEmail.subject;
      if (followUpEmail.body !== undefined) meeting.followUpEmail.body = followUpEmail.body;
    }

    const updated = await meeting.save();
    res.json(updated);
  } catch (error) {
    console.error("Update Meeting Error:", error);
    res.status(500).json({ error: "Failed to update meeting registry entry." });
  }
};

exports.getActionItems = async (req, res) => {
  try {
    const { status, owner } = req.query;

    const meetings = await Meeting.find({ owner: req.user.id });

    let flattened = [];
    meetings.forEach((meeting) => {
      meeting.actionItems.forEach((item) => {
        flattened.push({
          _id: item._id,
          id: item._id,
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          description: item.description,
          owner: item.owner || "Unassigned",
          deadline: item.deadline || "",
          confidence: item.confidence,
          status: item.status || "todo",
        });
      });
    });

    if (status) {
      flattened = flattened.filter((item) => item.status === status);
    }
    if (owner) {
      flattened = flattened.filter(
        (item) => item.owner.toLowerCase() === owner.toLowerCase()
      );
    }

    res.json(flattened);
  } catch (error) {
    console.error("Get Action Items Error:", error);
    res.status(500).json({ error: "Failed to fetch action items." });
  }
};

exports.updateActionItemStatus = async (req, res) => {
  try {
    const { meetingId, itemId } = req.params;
    const { status, owner, deadline } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const actionItem = meeting.actionItems.id(itemId);
    if (!actionItem) {
      return res.status(404).json({ error: "Action item not found in this meeting." });
    }

    if (status !== undefined) actionItem.status = status;
    if (owner !== undefined) actionItem.owner = owner;
    if (deadline !== undefined) actionItem.deadline = deadline;

    await meeting.save();
    res.json(actionItem);
  } catch (error) {
    console.error("Update Action Item Error:", error);
    res.status(500).json({ error: "Failed to update action item." });
  }
};
