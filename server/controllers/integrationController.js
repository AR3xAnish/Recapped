const Integration = require("../models/Integration");
const { encrypt } = require("../services/crypto");

exports.connectNotion = async (req, res) => {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri =
      process.env.NOTION_REDIRECT_URI ||
      "http://localhost:5000/api/integrations/notion/callback";

    if (!clientId) {
      console.log(
        "[Notion Integration] NOTION_CLIENT_ID not configured. Using Mock Redirect Simulation..."
      );
      const mockUrl = `${redirectUri}?code=mock_notion_code_xyz&state=${req.user.id}`;
      return res.json({ url: mockUrl });
    }

    const authorizeUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${req.user.id}`;
    res.json({ url: authorizeUrl });
  } catch (error) {
    console.error("Connect Notion Error:", error);
    res.status(500).json({ error: "Failed to initiate Notion connection." });
  }
};

exports.notionCallback = async (req, res) => {
  try {
    const { code, state } = req.query; // state is the userId
    const redirectUri =
      process.env.NOTION_REDIRECT_URI ||
      "http://localhost:5000/api/integrations/notion/callback";
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;

    const targetUserId = state;
    if (!targetUserId) {
      return res.status(400).send("State/userId parameter is missing.");
    }

    let accessToken = "mock_notion_token_123";

    if (clientId && clientSecret && code && code !== "mock_notion_code_xyz") {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64"
      );
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
        return res.status(400).send("Failed to exchange Notion authorization code.");
      }

      const tokenData = await response.json();
      accessToken = tokenData.access_token;
    } else {
      console.log("[Notion Integration] Mock Mode active. Storing mock Notion token.");
    }

    const encryptedToken = encrypt(accessToken);

    await Integration.findOneAndUpdate(
      { userId: targetUserId, provider: "notion" },
      { accessToken: encryptedToken },
      { upsert: true, new: true }
    );

    res.redirect("http://localhost:5173/settings?success=notion_connected");
  } catch (error) {
    console.error("Notion Callback Error:", error);
    res.status(500).send("Notion integration connection failed.");
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

    const { decrypt } = require("../services/crypto");
    const accessToken = decrypt(integration.accessToken);

    if (accessToken === "mock_notion_token_123") {
      return res.json([
        { id: "mock_db_minutes", title: "Minutes Ledger Actions" },
        { id: "mock_db_tasks", title: "General Action Items" },
      ]);
    }

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
      { new: true }
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
    });
  } catch (error) {
    console.error("Get Notion Status Error:", error);
    res.status(500).json({ error: "Failed to query Notion status." });
  }
};
