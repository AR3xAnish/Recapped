const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  rawTranscript: {
    type: String,
    required: true,
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

module.exports = mongoose.model("Meeting", MeetingSchema);
