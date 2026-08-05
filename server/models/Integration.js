const mongoose = require("mongoose");

const IntegrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  provider: {
    type: String,
    enum: ["notion", "slack"],
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  databaseId: {
    type: String,
  },
  databaseName: {
    type: String,
  },
  workspaceName: {
    type: String,
  },
  teamId: {
    type: String,
  },
  teamName: {
    type: String,
  },
  defaultChannelId: {
    type: String,
  },
  defaultChannelName: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Integration", IntegrationSchema);
