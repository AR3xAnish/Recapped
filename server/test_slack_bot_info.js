const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Integration = require("./models/Integration");
const { decrypt } = require("./services/crypto");

async function runBotInfo() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);

  const integration = await Integration.findOne({ provider: "slack" });
  if (!integration) {
    console.error("No Slack integration found.");
    await mongoose.connection.close();
    return;
  }

  const token = decrypt(integration.accessToken);

  console.log("\nCalling auth.test...");
  const response = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  console.log("auth.test response:", data);

  await mongoose.connection.close();
}

runBotInfo().catch((err) => {
  console.error("Failed:", err);
  mongoose.connection?.close();
});
