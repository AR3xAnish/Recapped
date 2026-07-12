# Recapped: Smart Meeting Scribe & QA Ledger

Recapped is a digitized ledger web application for recording, transcribing, and analyzing meeting commitments.

---

## MongoDB Atlas Vector Search Index Configuration

To enable the RAG (Retrieval-Augmented Generation) Q&A feature, you must configure a Vector Search Index on your MongoDB Atlas cluster. This must be done via the Atlas UI or the Atlas Admin API since it cannot be set up purely within the Mongoose application code.

### Configuration Steps:
1. Log in to your MongoDB Atlas dashboard.
2. Navigate to your Database cluster page.
3. Click on the **Atlas Search** or **Search** tab.
4. Click **Create Search Index**.
5. Select **Atlas Vector Search (JSON Editor)**.
6. Select your database (e.g. `test` or `meetmind`) and the **`transcriptchunks`** collection.
7. Set the Index Name to exactly: **`vector_index`**
8. Paste the JSON definition below into the editor:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "meetingId"
    }
  ]
}
```

9. Click **Next** and then **Create Search Index**.
10. Wait for the index status to turn green (Active). Once active, vector search queries can be executed successfully!

---

## Local Development Setup

### 1. Configure Environment Variables
Copy `server/.env.example` to `server/.env` and fill in the required variables:
- `MONGODB_URI`: MongoDB Atlas connection URI string
- `GROQ_API_KEY`: Groq Cloud API key
- `JWT_SECRET`: Secret key for authentication tokens
- `NOTION_CLIENT_ID`: Notion Developer Integration Client ID
- `NOTION_CLIENT_SECRET`: Notion Developer Integration Client Secret
- `NOTION_REDIRECT_URI`: OAuth callback redirect URL
- `NOTION_ENCRYPTION_KEY`: 32-byte hex string key for token encryption

### 2. Boot Application
Run the root package dev script:
```bash
npm run dev
```
- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:5000/`
