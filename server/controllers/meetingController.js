const Meeting = require("../models/Meeting");
const Integration = require("../models/Integration");
const mammoth = require("mammoth");
const PDFParser = require("pdf2json");
const path = require("path");
const fs = require("fs");
const { transcribeAudio } = require("../services/transcribe");
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

    let audioFilePath = undefined;
    let audioOriginalName = undefined;
    let audioMimeType = undefined;

    if (req.file) {
      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();

      if (!title) {
        title = path.basename(file.originalname, path.extname(file.originalname));
      }

      if (ext === ".mp3" || ext === ".m4a" || ext === ".wav") {
        source = "audio";
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        audioFilePath = path.join(uploadsDir, filename);
        fs.writeFileSync(audioFilePath, file.buffer);
        audioOriginalName = file.originalname;
        audioMimeType = file.mimetype;
        rawTranscript = ""; // pending transcription
      } else if (ext === ".txt") {
        source = "upload";
        rawTranscript = file.buffer.toString("utf-8");
      } else if (ext === ".docx") {
        source = "upload";
        const mammothResult = await mammoth.extractRawText({ buffer: file.buffer });
        rawTranscript = mammothResult.value;
      } else if (ext === ".pdf") {
        source = "upload";
        rawTranscript = await parsePdfBuffer(file.buffer);
      } else {
        return res.status(400).json({
          error:
            "Unsupported file type. Only .txt, .docx, .pdf, .mp3, .m4a, and .wav are allowed.",
        });
      }
    } else {
      if (!title || !transcriptText) {
        return res.status(400).json({ error: "Title and transcript text are required." });
      }
      rawTranscript = transcriptText;
    }

    if (source !== "audio" && (!rawTranscript || !rawTranscript.trim())) {
      return res.status(400).json({ error: "Transcript content cannot be empty." });
    }

    const meeting = new Meeting({
      title,
      rawTranscript: rawTranscript ? rawTranscript.trim() : "",
      source,
      status: "uploaded",
      owner: req.user.id,
      audioFilePath,
      audioOriginalName,
      audioMimeType,
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

            // Trigger background indexing without blocking rest of request completion
            const { indexMeeting } = require("../services/rag");
            indexMeeting(freshMeeting._id, freshMeeting.rawTranscript)
              .then((idxSuccess) => {
                if (!idxSuccess) {
                  console.error(`[Agent] Meeting ${freshMeeting._id} indexing failed.`);
                }
              })
              .catch(async (idxError) => {
                console.error(
                  `[Agent] Meeting ${freshMeeting._id} indexing encountered error:`,
                  idxError
                );
                try {
                  await Meeting.findByIdAndUpdate(freshMeeting._id, { chunked: false });
                } catch (dbErr) {
                  console.error("[Agent] Failed to update chunked status flag in DB:", dbErr);
                }
              });
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

exports.getMeetings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const sortBy = req.query.sortBy || "date";

    let query = { owner: req.user.id };

    if (search && search.trim() !== "") {
      query.$text = { $search: search };
    }

    let sortOption = {};
    if (sortBy === "title") {
      sortOption.title = 1;
    } else {
      sortOption.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const total = await Meeting.countDocuments(query);
    const meetings = await Meeting.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const data = meetings.map((meeting) => ({
      _id: meeting._id,
      title: meeting.title,
      date: meeting.createdAt,
      status: meeting.status,
      participantCount: meeting.participants ? meeting.participants.length : 0,
      actionItemCount: meeting.actionItems ? meeting.actionItems.length : 0,
    }));

    res.json({
      meetings: data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Meetings Error:", error);
    res.status(500).json({ error: "Failed to fetch meeting history logs." });
  }
};

exports.transcribeMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (meeting.source !== "audio" || !meeting.audioFilePath) {
      return res.status(400).json({ error: "This meeting registry entry is not an audio log source." });
    }

    if (!fs.existsSync(meeting.audioFilePath)) {
      return res.status(400).json({ error: "Audio file not found on server registry." });
    }

    // Temporarily update status to processing
    meeting.status = "processing";
    await meeting.save();

    const fileBuffer = fs.readFileSync(meeting.audioFilePath);

    try {
      console.log(`[Agent] Beginning transcription for meeting ${meeting._id}...`);
      const transcript = await transcribeAudio(
        fileBuffer,
        meeting.audioOriginalName,
        meeting.audioMimeType
      );

      meeting.rawTranscript = transcript;
      meeting.status = "uploaded"; // Ready for the /process step
      meeting.processingError = undefined;

      // Clean up audio file to save disk space
      try {
        fs.unlinkSync(meeting.audioFilePath);
        meeting.audioFilePath = undefined;
      } catch (unlinkErr) {
        console.error("[Agent] Failed to clean up audio file:", unlinkErr);
      }

      await meeting.save();
      res.json(meeting);
    } catch (transcribeError) {
      console.error("[Agent] Transcription failed:", transcribeError);
      meeting.status = "failed";
      meeting.processingError = transcribeError.message || "Transcription failed.";
      await meeting.save();
      res.status(500).json({ error: "Transcription failed: " + transcribeError.message });
    }
  } catch (error) {
    console.error("Transcribe Meeting Error:", error);
    res.status(500).json({ error: "Failed to run audio transcription." });
  }
};

const runNotionExport = async (
  userId,
  accessToken,
  databaseId,
  description,
  owner,
  deadline,
  meetingTitle,
  isRetry = false
) => {
  let activeDbId = databaseId;
  const { resolveExportDatabase } = require("../services/notion");

  if (!activeDbId) {
    activeDbId = await resolveExportDatabase(userId);
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${activeDbId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (response.status === 401) {
    console.warn(`[Notion Export] Revoked token detected for user ${userId}. Deleting integration.`);
    await Integration.findOneAndDelete({ userId, provider: "notion" });
    const err = new Error("Notion authentication has expired or been revoked.");
    err.code = "NOTION_UNAUTHORIZED";
    throw err;
  }

  if (response.status === 404) {
    if (!isRetry) {
      console.warn(
        `[Notion Export] Database ID ${activeDbId} returned 404. Clearing, re-creating and retrying once...`
      );
      const integration = await Integration.findOne({ userId, provider: "notion" });
      if (integration) {
        integration.databaseId = undefined;
        integration.databaseName = undefined;
        await integration.save();
      }
      const freshDbId = await resolveExportDatabase(userId);
      return await runNotionExport(
        userId,
        accessToken,
        freshDbId,
        description,
        owner,
        deadline,
        meetingTitle,
        true
      );
    } else {
      throw new Error(
        "Target Notion database could not be reached (returned 404 on retry)."
      );
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Retrieve Notion database failed: ${response.status} - ${errText}`);
  }

  const dbData = await response.json();
  const props = dbData.properties || {};

  let titlePropName = "title";
  for (const [key, val] of Object.entries(props)) {
    if (val.type === "title") {
      titlePropName = key;
      break;
    }
  }

  const missing = {};
  if (!props["Owner"]) missing["Owner"] = { rich_text: {} };
  if (!props["Deadline"]) missing["Deadline"] = { date: {} };
  if (!props["Meeting"]) missing["Meeting"] = { rich_text: {} };

  if (Object.keys(missing).length > 0) {
    const patchRes = await fetch(`https://api.notion.com/v1/databases/${activeDbId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: missing }),
    });
    if (!patchRes.ok) {
      console.warn("[Notion Export] Could not update database schema:", await patchRes.text());
    }
  }

  let dateVal = null;
  if (deadline && deadline.trim() !== "") {
    const parsed = Date.parse(deadline);
    if (!isNaN(parsed)) {
      dateVal = { start: new Date(parsed).toISOString().split("T")[0] };
    }
  }

  const pageBody = {
    parent: { database_id: activeDbId },
    properties: {
      [titlePropName]: {
        title: [{ text: { content: description || "Untitled Action Item" } }],
      },
      Owner: {
        rich_text: [{ text: { content: owner || "Unassigned" } }],
      },
      Meeting: {
        rich_text: [{ text: { content: meetingTitle || "Untitled Meeting" } }],
      },
    },
  };

  if (dateVal) {
    pageBody.properties["Deadline"] = { date: dateVal };
  }

  const pageRes = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pageBody),
  });

  if (pageRes.status === 401) {
    console.warn(`[Notion Export] Revoked token detected for user ${userId}. Deleting integration.`);
    await Integration.findOneAndDelete({ userId, provider: "notion" });
    const err = new Error("Notion authentication has expired or been revoked.");
    err.code = "NOTION_UNAUTHORIZED";
    throw err;
  }

  if (pageRes.status === 404) {
    if (!isRetry) {
      console.warn(
        `[Notion Export] Page creation returned 404. Clearing, re-creating and retrying once...`
      );
      const integration = await Integration.findOne({ userId, provider: "notion" });
      if (integration) {
        integration.databaseId = undefined;
        integration.databaseName = undefined;
        await integration.save();
      }
      const freshDbId = await resolveExportDatabase(userId);
      return await runNotionExport(
        userId,
        accessToken,
        freshDbId,
        description,
        owner,
        deadline,
        meetingTitle,
        true
      );
    } else {
      throw new Error(
        "Target Notion database could not be reached (returned 404 on page creation retry)."
      );
    }
  }

  if (!pageRes.ok) {
    const errText = await pageRes.text();
    throw new Error(`Notion Page Create failed: ${pageRes.status} - ${errText}`);
  }
};

exports.exportActionItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const meeting = await Meeting.findOne({ "actionItems._id": itemId });
    if (!meeting) {
      return res.status(404).json({ error: "Action item not found in database." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const actionItem = meeting.actionItems.id(itemId);
    if (!actionItem) {
      return res.status(404).json({ error: "Action item not found." });
    }

    const integration = await Integration.findOne({ userId: req.user.id, provider: "notion" });
    if (!integration) {
      return res.status(400).json({
        error: "Notion is not connected.",
        code: "NOTION_NOT_CONNECTED",
      });
    }

    const { decrypt } = require("../services/crypto");
    const accessToken = decrypt(integration.accessToken);
    const databaseId = integration.databaseId;

    await runNotionExport(
      req.user.id,
      accessToken,
      databaseId,
      actionItem.description,
      actionItem.owner,
      actionItem.deadline,
      meeting.title
    );

    res.json({ success: true, message: "Action item successfully exported to Notion." });
  } catch (error) {
    if (error.code === "NOTION_UNAUTHORIZED") {
      return res.status(401).json({ error: error.message, code: "NOTION_UNAUTHORIZED" });
    }
    console.error("Export Action Item Error:", error);
    res.status(500).json({ error: error.message || "Failed to export action item to Notion." });
  }
};

exports.exportAllActionItems = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!meeting.actionItems || meeting.actionItems.length === 0) {
      return res.status(400).json({ error: "No action items to export in this meeting." });
    }

    const integration = await Integration.findOne({ userId: req.user.id, provider: "notion" });
    if (!integration) {
      return res.status(400).json({
        error: "Notion is not connected.",
        code: "NOTION_NOT_CONNECTED",
      });
    }

    const { decrypt } = require("../services/crypto");
    const accessToken = decrypt(integration.accessToken);
    const databaseId = integration.databaseId;

    const results = [];
    for (const item of meeting.actionItems) {
      try {
        await runNotionExport(
          req.user.id,
          accessToken,
          databaseId,
          item.description,
          item.owner,
          item.deadline,
          meeting.title
        );
        results.push({ itemId: item._id, status: "success" });
      } catch (err) {
        if (err.code === "NOTION_UNAUTHORIZED") {
          return res.status(401).json({
            error: "Notion authentication has expired or been revoked. Please reconnect.",
            code: "NOTION_UNAUTHORIZED",
          });
        }
        console.error(`Failed to export action item ${item._id}:`, err.message);
        results.push({ itemId: item._id, status: "failed", error: err.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Export All Action Items Error:", error);
    res.status(500).json({ error: "Failed to run action items export." });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting registry entry not found." });
    }

    if (meeting.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You do not own this meeting registry entry." });
    }

    const TranscriptChunk = require("../models/TranscriptChunk");
    const QaTurn = require("../models/QaTurn");

    await TranscriptChunk.deleteMany({ meetingId: meeting._id });
    await QaTurn.deleteMany({ meetingId: meeting._id });
    await Meeting.deleteOne({ _id: meeting._id });

    res.json({
      success: true,
      message: "Meeting registry entry and associated history logs deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Meeting Error:", error);
    res.status(500).json({ error: "Failed to delete meeting registry entry." });
  }
};
