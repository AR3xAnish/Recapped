const mongoose = require("mongoose");

const QaTurnSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  question: {
    type: String,
    required: true,
    trim: true,
  },
  answer: {
    type: String,
    required: true,
  },
  sources: [
    {
      chunkIndex: { type: Number },
      excerpt: { type: String },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Fast chronological retrieval index
QaTurnSchema.index({ meetingId: 1, createdAt: 1 });

module.exports = mongoose.model("QaTurn", QaTurnSchema);
