const Integration = require("../models/Integration");
const { encrypt, decrypt } = require("../services/crypto");

exports.connectNotion = async (req, res) => {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    // Generate encrypted CSRF state parameter to prevent spoofing
    const stateObj = { userId: req.user.id, timestamp: Date.now() };
    const rawState = encrypt(JSON.stringify(stateObj));
    const state = Buffer.from(rawState, "utf8").toString("base64url");

    const authorizeUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}`;

    res.json({ url: authorizeUrl });
  } catch (error) {
    console.error("Connect Notion Error:", error);
    res.status(500).json({ error: "Failed to initiate Notion connection." });
  }
};

exports.notionCallback = async (req, res) => {
  const settingsBaseUrl = process.env.ALLOWED_ORIGINS + "/settings";
  try {
    const { code, state, error: notionError } = req.query;

    if (notionError) {
      console.error("[Notion OAuth Callback] Notion returned error:", notionError);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent(`Notion authentication error: ${notionError}`)}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Authorization code or state parameter is missing.")}`
      );
    }

    // 1. Validate the CSRF state parameter
    let stateObj;
    try {
      const rawState = Buffer.from(state, "base64url").toString("utf8");
      const decrypted = decrypt(rawState);
      stateObj = JSON.parse(decrypted);
    } catch (decryptErr) {
      console.error("[Notion OAuth Callback] State decryption failed:", decryptErr.message);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Invalid authorization state parameter (CSRF verification failed).")}`
      );
    }

    // Check expiration (max 15 minutes)
    const expirationLimit = 15 * 60 * 1000;
    if (Date.now() - stateObj.timestamp > expirationLimit) {
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Authorization state has expired. Please try again.")}`
      );
    }

    const targetUserId = stateObj.userId;
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    // 2. Exchange authorization code for access token via real Notion API
    console.log(`[Notion OAuth Callback] Exchanging code for user ${targetUserId}...`);
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Notion OAuth Callback Error]:", errorText);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Failed to exchange Notion authorization code with token endpoint.")}`
      );
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;
    const workspaceName = tokenData.workspace_name || "Notion Workspace";

    // 3. Encrypt and save the integration parameters
    const encryptedToken = encrypt(accessToken);

    await Integration.findOneAndUpdate(
      { userId: targetUserId, provider: "notion" },
      { accessToken: encryptedToken, workspaceName },
      { upsert: true, returnDocument: "after" }
    );

    try {
      const { resolveExportDatabase } = require("../services/notion");
      await resolveExportDatabase(targetUserId);
    } catch (dbErr) {
      console.error("[Notion OAuth Callback] Auto-provision database failed:", dbErr.message);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent(
          `Failed to auto-provision database: ${dbErr.message}`
        )}`
      );
    }

    res.redirect(`${settingsBaseUrl}?success=notion_connected`);
  } catch (error) {
    console.error("Notion Callback Error:", error);
    res.redirect(
      `${settingsBaseUrl}?error=${encodeURIComponent("An internal error occurred during connection callback.")}`
    );
  }
};

exports.getNotionDatabases = async (req, res) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user.id,
      provider: "notion",
    });
    if (!integration) {
      return res
        .status(404)
        .json({ error: "Notion is not connected.", code: "NOTION_NOT_CONNECTED" });
    }

    const accessToken = decrypt(integration.accessToken);

    const response = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "object",
          value: "database",
        },
      }),
    });

    if (response.status === 401) {
      console.warn(
        `[Notion API] Revoked token detected for user ${req.user.id}. Deleting integration.`
      );
      await Integration.findOneAndDelete({ userId: req.user.id, provider: "notion" });
      return res.status(401).json({
        error: "Notion authentication has expired or been revoked. Please reconnect.",
        code: "NOTION_UNAUTHORIZED",
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Notion Search API error: ${errText}` });
    }

    const searchData = await response.json();
    const databases = (searchData.results || [])
      .filter((item) => item.object === "database")
      .map((db) => {
        let title = "Untitled Database";
        if (db.title && db.title[0]) {
          title = db.title.map((t) => t.plain_text).join("");
        }
        return { id: db.id, title };
      });

    res.json(databases);
  } catch (error) {
    console.error("Get Notion Databases Error:", error);
    res.status(500).json({ error: "Failed to fetch Notion databases." });
  }
};

exports.setNotionDatabase = async (req, res) => {
  try {
    const { databaseId, databaseName } = req.body;
    if (!databaseId) {
      return res.status(400).json({ error: "databaseId is required." });
    }

    const updated = await Integration.findOneAndUpdate(
      { userId: req.user.id, provider: "notion" },
      { databaseId, databaseName },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ error: "Notion integration not found." });
    }

    res.json(updated);
  } catch (error) {
    console.error("Set Notion Database Error:", error);
    res.status(500).json({ error: "Failed to update integration database target." });
  }
};

exports.disconnectNotion = async (req, res) => {
  try {
    const deleted = await Integration.findOneAndDelete({
      userId: req.user.id,
      provider: "notion",
    });
    if (!deleted) {
      return res.status(404).json({ error: "No active Notion integration to disconnect." });
    }
    res.json({ message: "Notion integration successfully disconnected." });
  } catch (error) {
    console.error("Disconnect Notion Error:", error);
    res.status(500).json({ error: "Failed to disconnect Notion." });
  }
};

exports.getNotionStatus = async (req, res) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user.id,
      provider: "notion",
    });
    if (!integration) {
      return res.json({ connected: false });
    }
    res.json({
      connected: true,
      databaseId: integration.databaseId,
      databaseName: integration.databaseName,
      workspaceName: integration.workspaceName,
    });
  } catch (error) {
    console.error("Get Notion Status Error:", error);
    res.status(500).json({ error: "Failed to query Notion status." });
  }
};

exports.connectSlack = async (req, res) => {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    // Generate encrypted CSRF state parameter to prevent spoofing
    const stateObj = { userId: req.user.id, timestamp: Date.now() };
    const rawState = encrypt(JSON.stringify(stateObj));
    const state = Buffer.from(rawState, "utf8").toString("base64url");

    const scope = "chat:write,channels:read,chat:write.public";
    const authorizeUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${encodeURIComponent(
      scope
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({ url: authorizeUrl });
  } catch (error) {
    console.error("Connect Slack Error:", error);
    res.status(500).json({ error: "Failed to initiate Slack connection." });
  }
};

exports.slackCallback = async (req, res) => {
  const settingsBaseUrl = process.env.ALLOWED_ORIGINS + "/settings";
  try {
    const { code, state, error: slackError } = req.query;

    if (slackError) {
      console.error("[Slack OAuth Callback] Slack returned error:", slackError);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent(`Slack authentication error: ${slackError}`)}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Authorization code or state parameter is missing.")}`
      );
    }

    // 1. Validate the CSRF state parameter
    let stateObj;
    try {
      const rawState = Buffer.from(state, "base64url").toString("utf8");
      const decrypted = decrypt(rawState);
      stateObj = JSON.parse(decrypted);
    } catch (decryptErr) {
      console.error("[Slack OAuth Callback] State decryption failed:", decryptErr.message);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Invalid authorization state parameter (CSRF verification failed).")}`
      );
    }

    // Check expiration (max 15 minutes)
    const expirationLimit = 15 * 60 * 1000;
    if (Date.now() - stateObj.timestamp > expirationLimit) {
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Authorization state has expired. Please try again.")}`
      );
    }

    const targetUserId = stateObj.userId;
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    // 2. Exchange authorization code for bot access token via real Slack API
    console.log(`[Slack OAuth Callback] Exchanging code for user ${targetUserId}...`);

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Slack OAuth Callback Error]:", errorText);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent("Failed to exchange Slack authorization code with token endpoint.")}`
      );
    }

    const tokenData = await response.json();
    if (!tokenData.ok) {
      console.error("[Slack OAuth Callback Error] Slack returned failure status:", tokenData.error);
      return res.redirect(
        `${settingsBaseUrl}?error=${encodeURIComponent(`Slack token exchange failed: ${tokenData.error}`)}`
      );
    }

    const accessToken = tokenData.access_token;
    const teamId = tokenData.team?.id || "";
    const teamName = tokenData.team?.name || "Slack Workspace";

    // 3. Encrypt and save the Slack integration parameters
    const encryptedToken = encrypt(accessToken);

    await Integration.findOneAndUpdate(
      { userId: targetUserId, provider: "slack" },
      { accessToken: encryptedToken, teamId, teamName },
      { upsert: true, returnDocument: "after" }
    );

    res.redirect(`${settingsBaseUrl}?success=slack_connected`);
  } catch (error) {
    console.error("Slack Callback Error:", error);
    res.redirect(
      `${settingsBaseUrl}?error=${encodeURIComponent("An internal error occurred during Slack connection callback.")}`
    );
  }
};

exports.getSlackChannels = async (req, res) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user.id,
      provider: "slack",
    });
    if (!integration) {
      return res
        .status(404)
        .json({ error: "Slack is not connected.", code: "SLACK_NOT_CONNECTED" });
    }

    const accessToken = decrypt(integration.accessToken);

    const response = await fetch(
      "https://slack.com/api/conversations.list?exclude_archived=true&types=public_channel",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res
        .status(response.status)
        .json({ error: `Slack Conversations API error: ${errText}` });
    }

    const channelData = await response.json();
    if (!channelData.ok) {
      console.error("[Slack API] error response:", channelData.error);
      const authErrors = ["invalid_auth", "token_revoked", "account_inactive", "token_expired"];
      if (authErrors.includes(channelData.error)) {
        console.warn(
          `[Slack API] Revoked token detected for user ${req.user.id}. Deleting integration.`
        );
        await Integration.findOneAndDelete({ userId: req.user.id, provider: "slack" });
        return res.status(401).json({
          error: "Slack authentication has expired or been revoked. Please reconnect.",
          code: "SLACK_UNAUTHORIZED",
        });
      }
      return res.status(400).json({ error: `Slack API error: ${channelData.error}` });
    }

    const channels = (channelData.channels || []).map((ch) => ({
      id: ch.id,
      name: `#${ch.name}`,
    }));

    res.json(channels);
  } catch (error) {
    console.error("Get Slack Channels Error:", error);
    res.status(500).json({ error: "Failed to fetch Slack channels." });
  }
};

exports.setSlackChannel = async (req, res) => {
  try {
    const { channelId, channelName } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required." });
    }

    const updated = await Integration.findOneAndUpdate(
      { userId: req.user.id, provider: "slack" },
      { defaultChannelId: channelId, defaultChannelName: channelName },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ error: "Slack integration not found." });
    }

    res.json(updated);
  } catch (error) {
    console.error("Set Slack Channel Error:", error);
    res.status(500).json({ error: "Failed to update Slack channel target." });
  }
};

exports.disconnectSlack = async (req, res) => {
  try {
    const deleted = await Integration.findOneAndDelete({
      userId: req.user.id,
      provider: "slack",
    });
    if (!deleted) {
      return res.status(404).json({ error: "No active Slack integration to disconnect." });
    }
    res.json({ message: "Slack integration successfully disconnected." });
  } catch (error) {
    console.error("Disconnect Slack Error:", error);
    res.status(500).json({ error: "Failed to disconnect Slack." });
  }
};

exports.getSlackStatus = async (req, res) => {
  try {
    const integration = await Integration.findOne({
      userId: req.user.id,
      provider: "slack",
    });
    if (!integration) {
      return res.json({ connected: false });
    }
    res.json({
      connected: true,
      teamName: integration.teamName,
      defaultChannelId: integration.defaultChannelId,
      defaultChannelName: integration.defaultChannelName,
    });
  } catch (error) {
    console.error("Get Slack Status Error:", error);
    res.status(500).json({ error: "Failed to query Slack status." });
  }
};
