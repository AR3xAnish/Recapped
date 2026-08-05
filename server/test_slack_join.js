const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Integration = require("./models/Integration");
const { decrypt } = require("./services/crypto");

async function runJoinTest() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);

  const integration = await Integration.findOne({ provider: "slack" });
  if (!integration) {
    console.error("No Slack integration found.");
    await mongoose.connection.close();
    return;
  }

  const token = decrypt(integration.accessToken);
  const channelId = integration.defaultChannelId;

  console.log(`\nCalling conversations.join for channel ${channelId}...`);
  const response = await fetch("https://slack.com/api/conversations.join", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelId,
    }),
  });

  const data = await response.json();
  console.log("conversations.join response:", data);

  if (data.ok) {
    console.log("Successfully joined the channel! Now trying to post recap...");
    const { postMeetingRecap } = require("./services/slack");
    const mockMeeting = {
      _id: new mongoose.Types.ObjectId(),
      title: "Programmatic Join Verification Test",
      summary: "This message was posted after programmatically joining the channel.",
      actionItems: [{ description: "Verify receipt of this message", owner: "User", deadline: "Now" }],
    };
    await postMeetingRecap(integration.userId, mockMeeting);
  }

  await mongoose.connection.close();
}

runJoinTest().catch((err) => {
  console.error("Failed:", err);
  mongoose.connection?.close();
});
