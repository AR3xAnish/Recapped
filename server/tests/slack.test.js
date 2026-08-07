const test = require("node:test");
const assert = require("node:assert");
require("dotenv").config();
const mongoose = require("mongoose");
const Integration = require("../models/Integration");
const { postMeetingRecap } = require("../services/slack");
const { encrypt } = require("../services/crypto");

test("Slack Service: postMeetingRecap payload formatting and API trigger", async () => {
  // Mock Integration.findOne
  const originalFindOne = Integration.findOne;
  Integration.findOne = async () => {
    return {
      userId: "user123",
      provider: "slack",
      accessToken: encrypt("xoxb-mock-token"),
      defaultChannelId: "C12345",
    };
  };

  // Mock global fetch
  const originalFetch = global.fetch;
  let sentPayload = null;
  global.fetch = async (url, options) => {
    if (url.includes("chat.postMessage")) {
      sentPayload = JSON.parse(options.body);
    }
    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  };

  const mockMeeting = {
    _id: new mongoose.Types.ObjectId(),
    title: "Project Alignment Sync",
    summary: "The team aligned on the timeline.",
    actionItems: [
      { description: "Deploy database changes", owner: "Bob", deadline: "2026-08-10" },
      { description: "Verify CORS mappings", owner: undefined, deadline: undefined },
    ],
  };

  await postMeetingRecap("user123", mockMeeting);

  // Restore mocks
  Integration.findOne = originalFindOne;
  global.fetch = originalFetch;

  // Assertions
  assert.ok(sentPayload);
  assert.strictEqual(sentPayload.channel, "C12345");
  assert.ok(sentPayload.blocks);
  assert.strictEqual(sentPayload.blocks[0].type, "header");
  assert.ok(sentPayload.blocks[0].text.text.includes("Project Alignment Sync"));
  assert.ok(
    sentPayload.blocks[4].text.text.includes(
      "Deploy database changes (Owner: Bob, Deadline: 2026-08-10)"
    )
  );
  assert.ok(sentPayload.blocks[4].text.text.includes("Verify CORS mappings (Unassigned)"));
});
