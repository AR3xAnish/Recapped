const Integration = require("../models/Integration");
const { decrypt } = require("./crypto");

async function resolveExportDatabase(userId) {
  const integration = await Integration.findOne({ userId, provider: "notion" });
  if (!integration) {
    throw new Error("Notion integration not found for this user.");
  }

  // 1. Check MongoDB: does this user's Integration record already have a databaseId saved?
  if (integration.databaseId) {
    return integration.databaseId;
  }

  const accessToken = decrypt(integration.accessToken);

  // 2. If no databaseId is saved, check if an accessible database already exists
  console.log(`[Notion resolveExportDatabase] Searching for existing database for user ${userId}...`);
  const searchResponse = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "Recapped Action Items",
      filter: {
        property: "object",
        value: "database",
      },
    }),
  });

  if (searchResponse.status === 401) {
    console.warn(`[Notion API] Revoked token detected for user ${userId}. Deleting integration.`);
    await Integration.findOneAndDelete({ userId, provider: "notion" });
    const err = new Error("Notion authentication has expired or been revoked.");
    err.code = "NOTION_UNAUTHORIZED";
    throw err;
  }

  if (!searchResponse.ok) {
    const errText = await searchResponse.text();
    throw new Error(`Notion Search API failed: ${searchResponse.status} - ${errText}`);
  }

  const searchData = await searchResponse.json();
  const existingDb = (searchData.results || []).find(
    (item) =>
      item.object === "database" &&
      item.title?.[0]?.plain_text === "Recapped Action Items"
  );

  if (existingDb) {
    console.log(`[Notion resolveExportDatabase] Found existing database: ${existingDb.id}`);
    integration.databaseId = existingDb.id;
    integration.databaseName = "Recapped Action Items";
    await integration.save();
    return existingDb.id;
  }

  // 3. If none is found, find a parent page to create the database under
  console.log(`[Notion resolveExportDatabase] No database found. Searching for parent page...`);
  const pageSearchResponse = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        property: "object",
        value: "page",
      },
    }),
  });

  if (!pageSearchResponse.ok) {
    const errText = await pageSearchResponse.text();
    throw new Error(`Failed to find pages in Notion: ${pageSearchResponse.status} - ${errText}`);
  }

  const pageSearchData = await pageSearchResponse.json();
  const parentPage = (pageSearchData.results || []).find((item) => item.object === "page");

  if (!parentPage) {
    throw new Error(
      "No accessible pages found in Notion workspace. Please share at least one page during authentication."
    );
  }

  console.log(`[Notion resolveExportDatabase] Creating database under parent page: ${parentPage.id}`);

  // Create database via POST /v1/databases
  const dbResponse = await fetch("https://api.notion.com/v1/databases", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: {
        type: "page_id",
        page_id: parentPage.id,
      },
      title: [
        {
          type: "text",
          text: {
            content: "Recapped Action Items",
          },
        },
      ],
      properties: {
        Name: {
          title: {},
        },
        Owner: {
          rich_text: {},
        },
        Deadline: {
          date: {},
        },
        "Source Meeting": {
          rich_text: {},
        },
        Status: {
          select: {
            options: [
              { name: "To Do", color: "red" },
              { name: "In Progress", color: "orange" },
              { name: "Done", color: "green" },
            ],
          },
        },
      },
    }),
  });

  if (dbResponse.status === 401) {
    await Integration.findOneAndDelete({ userId, provider: "notion" });
    const err = new Error("Notion authentication has expired or been revoked.");
    err.code = "NOTION_UNAUTHORIZED";
    throw err;
  }

  if (!dbResponse.ok) {
    const errText = await dbResponse.text();
    throw new Error(`Notion Database Creation failed: ${dbResponse.status} - ${errText}`);
  }

  const newDb = await dbResponse.json();
  console.log(`[Notion resolveExportDatabase] Created database successfully: ${newDb.id}`);

  integration.databaseId = newDb.id;
  integration.databaseName = "Recapped Action Items";
  await integration.save();

  return newDb.id;
}

module.exports = {
  resolveExportDatabase,
};
