const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Integration = require("./models/Integration");
const { postMeetingRecap } = require("./services/slack");

async function runRealTest() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected successfully.");

  const integration = await Integration.findOne({ provider: "slack" });
  if (!integration) {
    console.error("No Slack integration found in the database.");
    await mongoose.connection.close();
    return;
  }

  console.log("\nSlack Integration Details:");
  console.log("Channel ID:", integration.defaultChannelId);
  console.log("Channel Name:", integration.defaultChannelName);

  const mockMeeting = {
    _id: new mongoose.Types.ObjectId(),
    title: "Post-Invite Verification Test",
    summary: "Checking if the recap posts successfully after the bot is invited to the channel.",
    actionItems: [
      { description: "Check Slack channel for this message", owner: "User", deadline: "Now" },
    ],
  };

  console.log("\nTriggering postMeetingRecap...");
  await postMeetingRecap(integration.userId, mockMeeting);

  await mongoose.connection.close();
  console.log("\nDatabase connection closed.");
}

runRealTest().catch((err) => {
  console.error("Test failed:", err);
  mongoose.connection?.close();
});
