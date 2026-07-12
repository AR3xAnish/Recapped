import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Highlight } from "../App";

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Edit recap states
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Notion integration states
  const [notionStatus, setNotionStatus] = useState({ connected: false, databaseId: null });
  const [exportStates, setExportStates] = useState({});
  const [bulkExportLoading, setBulkExportLoading] = useState(false);

  // RAG Q&A states
  const [qaTurns, setQaTurns] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState(null);
  const [indexRetrying, setIndexRetrying] = useState(false);

  const fetchMeeting = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get(`/meetings/${id}`);
      setMeeting(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch meeting registry entry.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting(true);
  }, [id, fetchMeeting]);

  useEffect(() => {
    const checkNotionStatus = async () => {
      try {
        const res = await api.get("/integrations/notion/status");
        setNotionStatus(res.data);
      } catch (err) {
        console.error("Failed to query Notion status:", err);
      }
    };
    checkNotionStatus();
  }, []);

  const handleExportItem = async (itemId) => {
    setExportStates((prev) => ({ ...prev, [itemId]: "loading" }));
    try {
      await api.post(`/action-items/${itemId}/export`);
      setExportStates((prev) => ({ ...prev, [itemId]: "success" }));
    } catch (err) {
      console.error("Failed to export action item:", err);
      if (
        err.response?.status === 401 ||
        err.response?.data?.code === "NOTION_UNAUTHORIZED"
      ) {
        alert(
          "Notion authentication has expired or been revoked. Redirecting to Settings sheet..."
        );
        navigate("/settings");
      } else {
        setExportStates((prev) => ({ ...prev, [itemId]: "failed" }));
      }
    }
  };

  const handleExportAll = async () => {
    setBulkExportLoading(true);
    try {
      const response = await api.post(`/meetings/${id}/export-all`);
      const newStates = {};
      response.data.forEach((res) => {
        newStates[res.itemId] = res.status === "success" ? "success" : "failed";
      });
      setExportStates((prev) => ({ ...prev, ...newStates }));
    } catch (err) {
      console.error("Failed to export all action items:", err);
      if (
        err.response?.status === 401 ||
        err.response?.data?.code === "NOTION_UNAUTHORIZED"
      ) {
        alert(
          "Notion authentication has expired or been revoked. Redirecting to Settings sheet..."
        );
        navigate("/settings");
      } else {
        alert(err.response?.data?.error || "Failed to bulk export action items.");
      }
    } finally {
      setBulkExportLoading(false);
    }
  };

  // Polling for processing status
  const meetingStatus = meeting?.status;
  useEffect(() => {
    let intervalId;
    if (meetingStatus === "processing") {
      setProcessing(true);
      intervalId = setInterval(async () => {
        try {
          const response = await api.get(`/meetings/${id}`);
          if (response.data.status !== "processing") {
            setMeeting(response.data);
            setProcessing(false);
            clearInterval(intervalId);
          } else {
            setMeeting(response.data);
          }
        } catch (err) {
          console.error("Error polling meeting status:", err);
        }
      }, 3000);
    } else {
      setProcessing(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [meetingStatus, id]);

  // Initialize edit states when meeting details load or finish processing
  useEffect(() => {
    if (meeting?.followUpEmail) {
      setEditedSubject(meeting.followUpEmail.subject || "");
      setEditedBody(meeting.followUpEmail.body || "");
    }
  }, [meeting?._id, meeting?.status, meeting?.followUpEmail]);

  const handleProcess = async () => {
    try {
      setError(null);
      setProcessing(true);
      const response = await api.post(`/meetings/${id}/process`);
      setMeeting((prev) => ({ ...prev, status: response.data.status }));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to trigger meeting analysis.");
      setProcessing(false);
    }
  };

  const handleTranscribe = async () => {
    try {
      setError(null);
      setTranscribing(true);
      const response = await api.post(`/meetings/${id}/transcribe`);
      setMeeting(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to run audio transcription.");
    } finally {
      setTranscribing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const response = await api.put(`/meetings/${id}`, {
        followUpEmail: {
          subject: editedSubject,
          body: editedBody,
        },
      });
      setMeeting(response.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save recap modifications.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    const recapText = `Subject: ${editedSubject}\n\n${editedBody}`;
    navigator.clipboard.writeText(recapText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchQaHistory = useCallback(async () => {
    try {
      const res = await api.get(`/meetings/${id}/qa-history`);
      setQaTurns(res.data);
    } catch (err) {
      console.error("Failed to load Q&A history:", err);
    }
  }, [id]);

  useEffect(() => {
    if (meeting?.status === "processed") {
      fetchQaHistory();
    }
  }, [meeting?.status, fetchQaHistory]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setQaLoading(true);
    setQaError(null);
    const q = newQuestion;
    setNewQuestion("");

    // Optimistically push the question with a loading indicator
    const optimisticTurn = {
      _id: "optimistic_" + Date.now(),
      question: q,
      answer: "",
      loading: true,
      sources: [],
    };
    setQaTurns((prev) => [...prev, optimisticTurn]);

    try {
      const res = await api.post(`/meetings/${id}/ask`, { question: q });
      setQaTurns((prev) =>
        prev.map((turn) =>
          turn._id === optimisticTurn._id ? res.data : turn
        )
      );
    } catch (err) {
      console.error("Failed to ask question:", err);
      const errMsg = err.response?.data?.error || "Failed to get an answer.";
      setQaError(errMsg);
      // Remove the optimistic bubble on failure
      setQaTurns((prev) => prev.filter((turn) => turn._id !== optimisticTurn._id));
    } finally {
      setQaLoading(false);
    }
  };

  const handleIndexRetry = async () => {
    setIndexRetrying(true);
    setQaError(null);
    try {
      await api.post(`/meetings/${id}/index`);
      await fetchMeeting();
      alert("Meeting transcript indexing started successfully!");
    } catch (err) {
      console.error("Failed to start indexing:", err);
      setQaError(err.response?.data?.error || "Failed to trigger indexing.");
    } finally {
      setIndexRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-8 text-center font-mono text-xs text-muted-sage">
        <span>[ Fetching entry REG_${id?.substring(0, 8)}... ]</span>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 text-xs font-mono mb-8">
          ENTRY ERROR: {error}
        </div>
        <Link to="/dashboard" className="text-ink-navy font-bold underline hover:text-muted-sage text-sm">
          &larr; Return to Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      {/* Detail Header */}
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage mb-4">
          <span>ENTRY ID: REG_{meeting._id}</span>
          <span>DATE RECORDED: {new Date(meeting.createdAt).toLocaleString()}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-ink-navy tracking-tight">
            {meeting.title}
          </h1>
          
          <div className="flex items-center space-x-3">
            {meeting.source === "audio" && !meeting.rawTranscript ? (
              <>
                {(meeting.status === "uploaded" || meeting.status === "failed") && (
                  <button
                    type="button"
                    onClick={handleTranscribe}
                    disabled={transcribing || meeting.status === "processing"}
                    className="border border-ink-navy text-ink-navy px-4 py-2 text-xs font-semibold uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {transcribing || meeting.status === "processing"
                      ? "Transcribing Audio..."
                      : "Transcribe Audio"}
                  </button>
                )}
                {meeting.status === "processing" && (
                  <span className="text-xs font-mono text-muted-sage animate-pulse">
                    [ Transcribing audio... ]
                  </span>
                )}
              </>
            ) : (
              <>
                {(meeting.status === "uploaded" || meeting.status === "failed") && (
                  <button
                    type="button"
                    onClick={handleProcess}
                    disabled={processing}
                    className="border border-ink-navy text-ink-navy px-4 py-2 text-xs font-semibold uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? "Starting Analysis..." : "Process Meeting"}
                  </button>
                )}
                {meeting.status === "processing" && (
                  <span className="text-xs font-mono text-muted-sage animate-pulse">
                    [ Analysis in progress... ]
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 mt-6 text-xs font-mono text-muted-sage">
          <div className="border border-muted-sage/30 px-2.5 py-1">
            SOURCE: <span className="text-ink-navy font-bold uppercase">{meeting.source}</span>
          </div>
          <div className="border border-muted-sage/30 px-2.5 py-1">
            STATUS: <Highlight>{meeting.status}</Highlight>
          </div>
        </div>

        {meeting.status === "failed" && meeting.processingError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 mt-6 text-xs font-mono">
            {meeting.source === "audio" && !meeting.rawTranscript
              ? `TRANSCRIPTION ERROR: ${meeting.processingError}`
              : `ANALYSIS ERROR: ${meeting.processingError}`}
          </div>
        )}
      </div>

      {/* Grid of Results (if processed) */}
      {meeting.status === "processed" && (
        <div className="space-y-12 mb-12">
          
          {/* Executive Summary */}
          {meeting.summary && (
            <div className="pb-8 border-b border-muted-sage/30">
              <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-4">
                Executive Ledger Summary
              </h2>
              <div className="border-l-4 border-ink-navy pl-4 py-1 italic text-base leading-relaxed text-ink-navy">
                {meeting.summary}
              </div>
            </div>
          )}

          {/* Scribe Recap Draft: Follow-Up Email */}
          {meeting.followUpEmail && (
            <div className="pb-8 border-b border-muted-sage/30 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage">
                  Scribe recap draft: follow-up email
                </h2>
                <div className="flex items-center space-x-3">
                  {saveSuccess && (
                    <span className="text-xs font-mono text-emerald-700 mr-2">
                      [ Saved successfully ]
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="border border-ink-navy text-ink-navy px-3 py-1 text-xs font-mono uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer"
                  >
                    {copied ? "[ Copied! ]" : "Copy Email"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="border border-ink-navy bg-ink-navy text-paper-cream px-3 py-1 text-xs font-mono uppercase hover:bg-transparent hover:text-ink-navy transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "[ Saving... ]" : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="border border-muted-sage/30 p-5 bg-paper-cream/40 space-y-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] uppercase font-mono text-muted-sage">Subject Line</label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="bg-transparent border border-muted-sage/20 px-3 py-2 text-sm text-ink-navy font-semibold focus:outline-none focus:border-ink-navy"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] uppercase font-mono text-muted-sage">Email Body</label>
                  <textarea
                    rows={12}
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="bg-transparent border border-muted-sage/20 px-3 py-2 text-sm text-ink-navy font-mono leading-relaxed focus:outline-none focus:border-ink-navy whitespace-pre-wrap"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="pb-8 border-b border-muted-sage/30">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-4">
              Scribe Registry: Participants & Roles
            </h2>
            {meeting.participants && meeting.participants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meeting.participants.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-muted-sage/10 pb-2">
                    <span className="text-ink-navy font-semibold">{p.name}</span>
                    <span className="text-muted-sage font-mono text-xs">{p.role || "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-sage italic">No participants extracted.</p>
            )}
          </div>

          {/* Key Decisions */}
          <div className="pb-8 border-b border-muted-sage/30">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-4">
              Key Decisions & Agreements
            </h2>
            {meeting.keyDecisions && meeting.keyDecisions.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {meeting.keyDecisions.map((dec, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-muted-sage font-mono mr-3">{String(idx + 1).padStart(2, "0")}.</span>
                    <span className="text-ink-navy leading-relaxed">{dec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-sage italic">No key decisions extracted.</p>
            )}
          </div>

          {/* Action Items */}
          <div className="pb-8 border-b border-muted-sage/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage">
                Extracted Action Items & Commitments
              </h2>
              {meeting.actionItems && meeting.actionItems.length > 0 && (
                <div>
                  {!notionStatus.connected || !notionStatus.databaseId ? (
                    <Link
                      to="/settings"
                      className="text-xs font-mono text-muted-sage underline hover:text-ink-navy"
                    >
                      [ Connect Notion database to export all ]
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExportAll}
                      disabled={bulkExportLoading}
                      className="border border-ink-navy text-ink-navy px-3 py-1 text-xs font-mono uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {bulkExportLoading ? "Exporting all..." : "Export all to Notion"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {meeting.actionItems && meeting.actionItems.length > 0 ? (
              <div className="border border-muted-sage/30 p-5 bg-paper-cream/40 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="text-muted-sage border-b border-muted-sage/20 pb-2">
                      <th className="pb-2 font-mono font-normal">TASK DESCRIPTION</th>
                      <th className="pb-2 font-mono font-normal">OWNER</th>
                      <th className="pb-2 font-mono font-normal">DEADLINE</th>
                      <th className="pb-2 font-mono font-normal">CONFIDENCE</th>
                      <th className="pb-2 font-mono font-normal text-right">NOTION EXPORT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted-sage/10 text-ink-navy">
                    {meeting.actionItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-ink-navy/5">
                        <td className="py-3 pr-4 font-sans text-sm font-normal">
                          {item.confidence === "high" ? (
                            <Highlight>{item.description}</Highlight>
                          ) : (
                            item.description
                          )}
                        </td>
                        <td className="py-3 pr-4 font-semibold">{item.owner}</td>
                        <td className="py-3 pr-4">{item.deadline || "—"}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-1.5 py-0.5 uppercase text-[10px] border ${
                            item.confidence === "high"
                              ? "border-emerald-500 text-emerald-800 dark:text-emerald-400"
                              : item.confidence === "medium"
                              ? "border-amber-500 text-amber-800 dark:text-amber-400"
                              : "border-gray-500 text-gray-800 dark:text-gray-400"
                          }`}>
                            {item.confidence}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono">
                          {!notionStatus.connected || !notionStatus.databaseId ? (
                            <span className="text-muted-sage/50 text-[10px] italic">Not connected</span>
                          ) : (
                            <div className="inline-flex items-center justify-end space-x-2">
                              {exportStates[item._id] === "success" ? (
                                <span className="text-emerald-700 font-bold flex items-center">
                                  ✓ <span className="text-[10px] uppercase font-semibold ml-1">Exported</span>
                                </span>
                              ) : exportStates[item._id] === "failed" ? (
                                <button
                                  type="button"
                                  onClick={() => handleExportItem(item._id)}
                                  className="text-red-700 font-bold border border-red-700/20 bg-red-500/5 px-2 py-0.5 rounded hover:bg-red-500/10 cursor-pointer flex items-center"
                                  title="Export failed. Click to retry."
                                >
                                  ✗ <span className="text-[10px] uppercase font-semibold ml-1">Retry</span>
                                </button>
                              ) : exportStates[item._id] === "loading" ? (
                                <span className="text-muted-sage animate-pulse text-[10px] uppercase font-semibold">
                                  Pushing...
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleExportItem(item._id)}
                                  className="border border-ink-navy text-ink-navy px-2 py-0.5 text-[10px] uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer font-bold"
                                >
                                  Export
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-sage italic">No action items extracted.</p>
            )}
          </div>

          {/* RAG Q&A Panel */}
          <div className="pb-8 border-b border-muted-sage/30">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-4">
              Transcript QA Ledger Board
            </h2>

            {!meeting.chunked ? (
              <div className="border border-dashed border-amber-500/40 bg-amber-500/5 p-6 font-mono text-xs text-amber-900 space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="animate-pulse">●</span>
                  <span className="font-bold uppercase">Preparing Registry Log for Questions</span>
                </div>
                <p className="font-sans leading-relaxed text-xs">
                  This meeting transcript is currently undergoing background vector index ingestion. If this has taken longer than expected, you may manually trigger/retry indexing below.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={handleIndexRetry}
                    disabled={indexRetrying}
                    className="border border-amber-700 text-amber-800 px-4 py-2 font-semibold uppercase hover:bg-amber-700 hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {indexRetrying ? "Ingesting..." : "Force Ingest Vector Index"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-muted-sage/30 p-5 bg-paper-cream/40 flex flex-col space-y-4">
                {/* Chat Log history */}
                <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2 font-sans">
                  {qaTurns.length === 0 ? (
                    <div className="text-xs text-muted-sage font-mono italic text-center py-6">
                      [ No questions recorded for this ledger log entry yet. ]
                    </div>
                  ) : (
                    qaTurns.map((turn) => (
                      <div key={turn._id} className="space-y-3">
                        {/* Question Bubble */}
                        <div className="flex justify-end">
                          <div className="bg-ink-navy text-paper-cream px-4 py-2 max-w-[80%] text-sm rounded shadow-sm">
                            <span className="font-mono text-[9px] text-muted-sage block uppercase tracking-wider mb-1">Question</span>
                            <span className="leading-relaxed font-sans">{turn.question}</span>
                          </div>
                        </div>

                        {/* Answer Bubble */}
                        <div className="flex justify-start">
                          <div className="bg-paper-cream border border-muted-sage/30 text-ink-navy px-4 py-2 max-w-[80%] text-sm rounded shadow-sm w-full">
                            <span className="font-mono text-[9px] text-muted-sage block uppercase tracking-wider mb-1">Answer</span>
                            {turn.loading ? (
                              <div className="flex items-center space-x-2 text-xs font-mono text-muted-sage animate-pulse">
                                <span>Thinking...</span>
                              </div>
                            ) : (
                              <>
                                <span className="leading-relaxed font-sans block whitespace-pre-wrap">{turn.answer}</span>
                                
                                {/* Sources citation collapse */}
                                {turn.sources && turn.sources.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-muted-sage/20">
                                    <details className="cursor-pointer group">
                                      <summary className="text-[10px] font-mono text-muted-sage hover:text-ink-navy select-none list-none flex items-center">
                                        <span className="inline-block transition-transform group-open:rotate-90 mr-1.5">&rarr;</span>
                                        <span>Show Sources ({turn.sources.length})</span>
                                      </summary>
                                      <div className="mt-2 space-y-2 pl-3 border-l border-muted-sage/30 max-h-[150px] overflow-y-auto">
                                        {turn.sources.map((src, sidx) => (
                                          <div key={sidx} className="text-[11px] font-sans text-muted-sage leading-relaxed bg-paper-cream/60 p-2 border border-muted-sage/10 rounded">
                                            <span className="font-mono text-[9px] block uppercase font-bold text-ink-navy mb-1">Excerpt #{src.chunkIndex + 1}</span>
                                            {src.excerpt}
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input box form */}
                <form onSubmit={handleAsk} className="pt-4 border-t border-muted-sage/20 flex gap-2">
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    disabled={qaLoading}
                    placeholder="Ask a question about this meeting's transcript..."
                    className="flex-grow bg-transparent border border-muted-sage/30 px-3 py-2 text-sm text-ink-navy focus:outline-none focus:border-ink-navy disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={qaLoading || !newQuestion.trim()}
                    className="border border-ink-navy bg-ink-navy text-paper-cream px-4 py-2 text-xs font-semibold uppercase hover:bg-transparent hover:text-ink-navy transition-colors duration-150 cursor-pointer disabled:opacity-50"
                  >
                    {qaLoading ? "Asking..." : "Ask"}
                  </button>
                </form>

                {qaError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 text-xs font-mono">
                    QA ERROR: {qaError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Transcript Block */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage">
          Raw Transcript Ledger Block
        </h2>
        <div className="border border-muted-sage/30 p-8 bg-paper-cream/30 min-h-[300px] flex items-center justify-center">
          {meeting.rawTranscript ? (
            <pre className="w-full font-mono text-sm text-ink-navy whitespace-pre-wrap leading-relaxed font-normal">
              {meeting.rawTranscript}
            </pre>
          ) : (
            <div className="text-xs font-mono text-muted-sage/50 italic text-center">
              {meeting.source === "audio"
                ? "[ Audio file uploaded. Click 'Transcribe Audio' above to transcribe. ]"
                : "[ Transcript is empty. ]"}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-muted-sage/20 pt-8">
        <Link
          to="/dashboard"
          className="border border-ink-navy text-ink-navy px-4 py-2 text-sm font-semibold hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 inline-block cursor-pointer"
        >
          &larr; Return to Ledger
        </Link>
      </div>
    </div>
  );
}
