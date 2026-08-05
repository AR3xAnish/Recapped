const Integration = require("../models/Integration");
const { decrypt } = require("./crypto");

/**
 * Automatically posts a formatted meeting recap to Slack if integrated.
 * This is non-blocking and will log errors on failure.
 *
 * @param {string} userId - Owner ID of the meeting.
 * @param {object} meeting - The processed meeting document.
 */
async function postMeetingRecap(userId, meeting) {
  try {
    const integration = await Integration.findOne({ userId, provider: "slack" });
    if (!integration || !integration.defaultChannelId) {
      console.log(`[Slack Service] No Slack integration or default channel found for user: ${userId}`);
      return;
    }

    let token;
    try {
      token = decrypt(integration.accessToken);
    } catch (decryptErr) {
      console.error("[Slack Service] Failed to decrypt access token:", decryptErr);
      return;
    }

    // Format action items in Slack markdown format
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

    // Construct Slack Block Kit payload
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

    // Programmatically join the channel before posting to ensure member access
    try {
      console.log(`[Slack Service] Programmatically joining channel ${integration.defaultChannelId}...`);
      await fetch("https://slack.com/api/conversations.join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel: integration.defaultChannelId,
        }),
      });
    } catch (joinErr) {
      console.warn("[Slack Service] Programmatic channel join failed:", joinErr);
    }

    console.log(
      `[Slack Service] Posting recap for meeting ${meeting._id} to channel ${integration.defaultChannelId}...`
    );

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

    const data = await response.json();
    if (!data.ok) {
      console.error("[Slack Service] Slack API returned error:", data.error);
      const authErrors = ["invalid_auth", "token_revoked", "account_inactive", "token_expired"];
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
