const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Integration = require("./models/Integration");
const Meeting = require("./models/Meeting");

async function checkDb() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected successfully.");

  console.log("\n--- Active Integrations in Database ---");
  const integrations = await Integration.find({});
  if (integrations.length === 0) {
    console.log("No integrations found in the database.");
  } else {
    integrations.forEach((integration) => {
      console.log({
        id: integration._id,
        userId: integration.userId,
        provider: integration.provider,
        teamName: integration.teamName,
        defaultChannelId: integration.defaultChannelId,
        defaultChannelName: integration.defaultChannelName,
        databaseId: integration.databaseId,
        databaseName: integration.databaseName,
        workspaceName: integration.workspaceName,
      });
    });
  }

  console.log("\n--- Recent Meetings in Database ---");
  const meetings = await Meeting.find({}).sort({ createdAt: -1 }).limit(5);
  if (meetings.length === 0) {
    console.log("No meetings found in the database.");
  } else {
    meetings.forEach((m) => {
      console.log({
        id: m._id,
        title: m.title,
        status: m.status,
        source: m.source,
        hasSummary: !!m.summary,
        hasActionItems: m.actionItems?.length || 0,
        createdAt: m.createdAt,
      });
    });
  }

  await mongoose.connection.close();
}

checkDb().catch((err) => {
  console.error("Failed checking database:", err);
});
