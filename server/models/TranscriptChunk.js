const mongoose = require("mongoose");

const TranscriptChunkSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  chunkText: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    required: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for fast chunk retrievals by meeting
TranscriptChunkSchema.index({ meetingId: 1 });

module.exports = mongoose.model("TranscriptChunk", TranscriptChunkSchema);
