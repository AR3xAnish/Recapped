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
  const settingsBaseUrl = "http://localhost:5173/settings";
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
      console.warn(`[Notion API] Revoked token detected for user ${req.user.id}. Deleting integration.`);
      await Integration.findOneAndDelete({ userId: req.user.id, provider: "notion" });
      return res.status(401).json({
        error: "Notion authentication has expired or been revoked. Please reconnect.",
        code: "NOTION_UNAUTHORIZED",
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return res
        .status(response.status)
        .json({ error: `Notion Search API error: ${errText}` });
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
