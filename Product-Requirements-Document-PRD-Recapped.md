# Product Requirements Document (PRD): Recapped

## 1. Executive Summary
**Recapped** is an AI-driven meeting intelligence platform designed to bridge the gap between verbal commitments and actionable records. By transforming raw transcripts and audio recordings into structured data—including participants, decisions, and action items—Recapped automates the post-meeting workflow. The system features a durable Kanban-style tracking board, a grounded Retrieval-Augmented Generation (RAG) interface for meeting-specific queries, and seamless integrations with Notion and Slack.

## 2. Problem Statement
Meetings often result in "perishable" information. Decisions and commitments live only in the participants' memories, manual note-taking is inconsistent, and follow-up emails are frequently delayed or forgotten. Without a centralized system of record, action items are lost, leading to re-negotiated commitments and project delays.

## 3. Goals & Objectives
*   **Automated Extraction:** Extract structured data (participants, decisions, action items) with zero manual tagging.
*   **Efficiency:** Reduce the time between "meeting end" and "follow-up sent" to near-zero.
*   **Persistence:** Provide a durable home for action items that survives beyond the meeting context.
*   **Fact-Based Retrieval:** Enable users to query past meetings with answers grounded strictly in the transcript to prevent hallucinations.
*   **Integration:** Automate the flow of data into existing productivity tools (Notion, Slack).

### 3.1 Non-Goals
*   Real-time/live transcription during active calls.
*   Cross-meeting Q&A (queries are strictly scoped to a single meeting).
*   Integrations beyond Notion and Slack (e.g., no Jira, Trello, or Salesforce in this version).
*   Multi-user collaboration on a single meeting record.
*   Inline editing of entities during the extraction phase.

## 4. Target Users / Stakeholders
*   **Primary User:** Individuals or small team members who manage recurring meetings and require automated documentation and tracking without manual overhead.

## 5. Functional Requirements

### 5.1 Transcript Ingestion
*   **Multi-format Support:** Accept pasted text, file uploads (.txt, .docx, .pdf), and audio files (.mp3, .m4a, .wav).
*   **Transcription Pipeline:** Audio files must be processed via the Whisper API before downstream analysis.
*   **Error Handling:** Explicitly reject unsupported file types or oversized files with clear user feedback.

### 5.2 Extraction & Summarization
*   **Entity Recognition:** Identify participants, key decisions, and action items (including description, owner, deadline, and confidence score).
*   **Long-form Processing:** Handle transcripts exceeding LLM context windows via a chunk-and-merge strategy to prevent duplicate entities.
*   **Artifact Generation:** Produce a plain-language summary and an editable follow-up email draft.

### 5.3 Action Item Tracking
*   **Kanban Interface:** A cross-meeting board with "To Do," "In Progress," and "Done" statuses.
*   **Bidirectional Sync:** Status changes on the board must reflect in the source meeting record and vice versa.
*   **Filtering:** Users must be able to filter action items by owner and source meeting.

### 5.4 Retrieval-Augmented Q&A (RAG)
*   **Meeting-Scoped Indexing:** Transcripts must be chunked, embedded, and stored in MongoDB Atlas Vector Search.
*   **Hard Filtering:** Queries must be strictly filtered by `meeting_id` to prevent data leakage.
*   **Groundedness:** The system must state "I don't know" if the answer is not in the transcript and must provide source excerpts for every answer.

### 5.5 Notion Integration
*   **OAuth Flow:** Single-click Notion account connection.
*   **Auto-Provisioning:** Automatically resolve or create a target database upon first export.
*   **Export Capabilities:** Support individual or bulk export of action items as Notion pages.

### 5.6 Slack Integration
*   **Automated Notifications:** Automatically post meeting summaries and action items to a designated Slack channel upon processing completion.
*   **Non-blocking Failures:** Integration failures (e.g., expired tokens) must be logged and surfaced but must not halt the primary meeting processing pipeline.

## 6. Non-Functional Requirements
*   **Grounding over Fluency:** Prioritize factual accuracy and "not mentioned" responses over conversational but unsupported AI responses.
*   **Fail Loud:** System must prevent startup or execution if critical configurations (API keys, OAuth credentials) are missing.
*   **Stateless-Safe:** Backend logic must not rely on local file persistence or in-memory state between requests to remain serverless-compatible.
*   **Data Isolation:** Strict multi-tenancy; users must never be able to access another user's meetings, tokens, or vector data.

## 7. System Architecture Overview
The system follows a modular service-oriented architecture:
1.  **Frontend:** A React-based SPA for user interaction.
2.  **API Gateway:** A Node.js/Express layer handling JWT authentication and routing.
3.  **Meeting Service:** The orchestrator using LangChain.js and Groq for extraction.
4.  **Transcription Service:** A dedicated worker for Whisper API interfacing.
5.  **RAG Service:** Manages vector embeddings and semantic search logic.
6.  **Integration Service:** Manages OAuth 2.0 flows and external API communication (Notion/Slack).

## 8. Tech Stack
*   **Frontend:** React, Tailwind CSS
*   **Backend:** Node.js, Express
*   **LLM Orchestration:** LangChain.js
*   **LLM Provider:** Groq (Llama 3.1)
*   **Transcription:** OpenAI Whisper API
*   **Database:** MongoDB Atlas
*   **Vector Search:** MongoDB Atlas Vector Search
*   **Authentication:** JWT (Session), OAuth 2.0 (Third-party)
*   **File Handling:** Multer (for audio uploads)

## 9. Data Requirements
*   **Main Database (MongoDB Atlas):**
    *   `Users`: Profiles and integration metadata.
    *   `Meetings`: Metadata, raw transcripts, and summaries.
    *   `ActionItems`: Descriptions, owners, deadlines, and Kanban status.
*   **Vector Database:**
    *   `TranscriptChunks`: Embedded text segments indexed with a mandatory `meeting_id` metadata field for hard-filtering.

## 10. API Specifications (Key Endpoints)
*   `POST /api/ingest`: Accepts text or multipart/form-data (audio/docs).
*   `GET /api/meetings`: Paginated list of processed meetings.
*   `GET /api/meetings/:id/qa`: Endpoint for RAG-based questions.
*   `PATCH /api/action-items/:id`: Update Kanban status.
*   `POST /api/integrations/notion/export`: Trigger sync to Notion.

## 11. Security Requirements
*   **Authentication:** All API routes (except login/callback) require a valid JWT.
*   **Authorization:** Ownership checks on every database query to ensure data isolation.
*   **Credential Management:** OAuth tokens and API keys must be encrypted at rest.

## 12. Deployment & Infrastructure
*   **Backend:** Node.js/Express environment (Stateless logic).
*   **Database:** Managed MongoDB Atlas cluster.
*   **Storage:** Temporary handling of audio files via Multer (no long-term local storage).

## 13. Success Metrics
*   **Accuracy:** Successful extraction of >90% of explicitly stated action items in test transcripts.
*   **Latency:** Follow-up email draft and summary generated within 30 seconds of transcript ingestion.
*   **Reliability:** 100% success rate for Notion exports when valid OAuth tokens are present.
*   **Security:** Zero instances of cross-meeting data retrieval in Q&A testing.

## 14. Timeline & Milestones
*   **Phase 1: Core Pipeline:** Ingestion, Whisper transcription, and basic LLM extraction.
*   **Phase 2: Data & Tracking:** MongoDB integration and Kanban board implementation.
*   **Phase 3: RAG & Q&A:** Vector search implementation and grounded query interface.
*   **Phase 4: Integrations:** OAuth implementation for Slack and Notion.

## 15. Open Questions & Risks
*   **Risk:** Quality of extraction is highly dependent on the quality of the input transcript (e.g., poor audio quality leading to Whisper errors).
*   **Risk:** LLM rate limits on Groq during high-concurrency usage.
*   **Question:** How should the system handle meetings where multiple participants have the same first name? (Current plan: rely on LLM context or full-name attribution if available).