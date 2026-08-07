/**
 * @file slack.js
 * @description Background service for constructing and publishing formatted meeting summaries
 * and action items to Slack channels using Slack Block Kit. Contains token error-handling
 * logic to auto-cleanup revoked credentials.
 */

const Integration = require("../models/Integration");
const { decrypt } = require("./crypto");

/**
 * Formats a processed meeting recap and action items lists into Slack's Block Kit structure,
 * then posts the payload via the Slack API (chat.postMessage) to the configured target channel.
 * This function executes asynchronously and is non-blocking to prevent interrupting the main request.
 *
 * @async
 * @function postMeetingRecap
 * @param {string} userId - The unique identifier of the user (owner of the meeting).
 * @param {Object} meeting - The processed meeting document from MongoDB.
 * @param {string} meeting._id - The database ID of the meeting.
 * @param {string} meeting.title - The user-facing title of the meeting.
 * @param {string} meeting.summary - The extracted executive summary.
 * @param {Array<Object>} meeting.actionItems - List of extracted action item commitments.
 * @param {string} meeting.actionItems[].description - The commitment description.
 * @param {string} [meeting.actionItems[].owner] - Assigned owner for the commitment.
 * @param {string} [meeting.actionItems[].deadline] - Optional deadline string.
 * @returns {Promise<void>} Resolves when the message request has completed (success or logged failure).
 */
async function postMeetingRecap(userId, meeting) {
  try {
    // 1. Retrieve the user's active Slack integration details from the database
    const integration = await Integration.findOne({ userId, provider: "slack" });
    if (!integration || !integration.defaultChannelId) {
      console.log(
        `[Slack Service] No Slack integration or default channel found for user: ${userId}`
      );
      return;
    }

    // 2. Decrypt the bot access token stored securely at rest
    let token;
    try {
      token = decrypt(integration.accessToken);
    } catch (decryptErr) {
      console.error("[Slack Service] Failed to decrypt access token:", decryptErr);
      return;
    }

    // 3. Assemble and format the action items list using Slack markdown bullet points
    let actionItemsText = "*Action Items*\n";
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      meeting.actionItems.forEach((item) => {
        const owner = item.owner ? `Owner: ${item.owner}` : "Unassigned";
        const deadline = item.deadline ? `, Deadline: ${item.deadline}` : "";
        actionItemsText += `• ${item.description} (${owner}${deadline})\n`;
      });
    } else {
      actionItemsText += "• No action items identified.\n";
    }

    // 4. Construct the Slack Block Kit payload (header, summaries, action lists, dividers)
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📝 Meeting Recap: ${meeting.title}`,
          emoji: true,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Summary*\n${meeting.summary || "No summary available."}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: actionItemsText,
        },
      },
    ];

    console.log(
      `[Slack Service] Posting recap for meeting ${meeting._id} to channel ${integration.defaultChannelId}...`
    );

    // 5. Send POST request to Slack API chat.postMessage endpoint using Bearer Token authorization
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: integration.defaultChannelId,
        text: `Meeting Recap: ${meeting.title}`,
        blocks: blocks,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Slack Service] Request failed:", errorText);
      return;
    }

    // 6. Handle Slack API errors (e.g. revoked or invalid tokens)
    const data = await response.json();
    if (!data.ok) {
      console.error("[Slack Service] Slack API returned error:", data.error);
      const authErrors = ["invalid_auth", "token_revoked", "account_inactive", "token_expired"];

      // Auto-cleanup: If token is revoked or expired, delete integration record from the database
      if (authErrors.includes(data.error)) {
        console.warn(
          `[Slack Service] Revoked or invalid token detected for user ${userId}. Deleting integration.`
        );
        await Integration.findOneAndDelete({ userId, provider: "slack" });
      }
    } else {
      console.log(`[Slack Service] Recap successfully posted for meeting: ${meeting._id}`);
    }
  } catch (error) {
    console.error("[Slack Service] Unhandled error during recap post:", error);
  }
}

module.exports = {
  postMeetingRecap,
};
