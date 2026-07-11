const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  rawTranscript: {
    type: String,
    required: false,
  },
  source: {
    type: String,
    enum: ["paste", "upload", "audio"],
    required: true,
  },
  status: {
    type: String,
    enum: ["uploaded", "processing", "processed", "failed"],
    default: "uploaded",
  },
  audioFilePath: {
    type: String,
  },
  audioOriginalName: {
    type: String,
  },
  audioMimeType: {
    type: String,
  },
  participants: [
    {
      name: { type: String, trim: true },
      role: { type: String, trim: true },
    },
  ],
  actionItems: [
    {
      description: { type: String, trim: true },
      owner: { type: String, trim: true },
      deadline: { type: String, trim: true },
      confidence: { type: String, enum: ["high", "medium", "low"] },
      status: {
        type: String,
        enum: ["todo", "in_progress", "done"],
        default: "todo",
      },
      meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
      },
    },
  ],
  keyDecisions: [
    { type: String, trim: true },
  ],
  processingError: {
    type: String,
  },
  summary: {
    type: String,
  },
  followUpEmail: {
    subject: { type: String, trim: true },
    body: { type: String },
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

MeetingSchema.index({ title: "text", "participants.name": "text" });

module.exports = mongoose.model("Meeting", MeetingSchema);
