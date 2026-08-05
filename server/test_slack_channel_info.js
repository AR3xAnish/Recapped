const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Integration = require("./models/Integration");
const { decrypt } = require("./services/crypto");

async function checkChannel() {
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

  console.log(`\nCalling conversations.info for channel ${channelId}...`);
  const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log("conversations.info response:", data);

  await mongoose.connection.close();
}

checkChannel().catch((err) => {
  console.error("Failed:", err);
  mongoose.connection?.close();
});
