const Meeting = require("../models/Meeting");
const QaTurn = require("../models/QaTurn");
const TranscriptChunk = require("../models/TranscriptChunk");
const { indexMeeting, askMeetingQuestion } = require("../services/rag");

exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === "") {
      return res.status(400).json({ error: "Question is required." });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Check if the meeting has been chunked/indexed
    const chunkCount = await TranscriptChunk.countDocuments({ meetingId: meeting._id });
    if (!meeting.chunked || chunkCount === 0) {
      return res.status(400).json({
        error: "Still preparing this meeting for questions.",
        code: "MEETING_NOT_INDEXED",
      });
    }

    // Ask question via RAG pipeline
    const { answer, sources } = await askMeetingQuestion(meeting._id, question);

    // Save Q&A turn in MongoDB
    const qaTurn = await QaTurn.create({
      meetingId: meeting._id,
      question,
      answer,
      sources,
    });

    res.json(qaTurn);
  } catch (error) {
    if (error.code === "NOTION_UNAUTHORIZED") {
      // ignore
    }
    console.error("Ask Question Error:", error);
    res.status(500).json({ error: error.message || "Failed to process question." });
  }
};

exports.getQaHistory = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const history = await QaTurn.find({ meetingId: meeting._id }).sort({ createdAt: 1 });
    res.json(history);
  } catch (error) {
    console.error("Get QA History Error:", error);
    res.status(500).json({ error: "Failed to fetch Q&A logs." });
  }
};

exports.retryIndexing = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!meeting.rawTranscript || meeting.rawTranscript.trim() === "") {
      return res.status(400).json({ error: "Cannot index meeting with an empty transcript." });
    }

    console.log(`[RAG Controller] Triggering manual indexing retry for meeting ${meeting._id}...`);
    const success = await indexMeeting(meeting._id, meeting.rawTranscript);

    if (success) {
      res.json({ success: true, message: "Indexing completed successfully." });
    } else {
      res.status(500).json({ error: "Indexing failed to execute." });
    }
  } catch (error) {
    console.error("Retry Indexing Error:", error);
    res.status(500).json({ error: error.message || "Failed to index meeting." });
  }
};
