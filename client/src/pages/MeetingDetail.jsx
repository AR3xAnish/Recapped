import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { Highlight } from "../App";

export default function MeetingDetail() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const response = await api.get(`/meetings/${id}`);
        setMeeting(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch meeting registry entry.");
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-8 text-center font-mono text-xs text-muted-sage">
        <span>[ Fetching entry REG_${id?.substring(0, 8)}... ]</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8">
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 text-xs font-mono mb-8">
          ENTRY ERROR: {error}
        </div>
        <Link to="/" className="text-ink-navy font-bold underline hover:text-muted-sage text-sm">
          &larr; Return to Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage mb-4">
          <span>ENTRY ID: REG_{meeting._id}</span>
          <span>DATE RECORDED: {new Date(meeting.createdAt).toLocaleString()}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy tracking-tight">
          {meeting.title}
        </h1>
        
        <div className="flex flex-wrap gap-4 mt-4 text-xs font-mono text-muted-sage">
          <div className="border border-muted-sage/30 px-2.5 py-1">
            SOURCE: <span className="text-ink-navy font-bold uppercase">{meeting.source}</span>
          </div>
          <div className="border border-muted-sage/30 px-2.5 py-1">
            STATUS: <Highlight>{meeting.status}</Highlight>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage">
          Raw Transcript Ledger Block
        </h2>
        <div className="border border-muted-sage/30 p-8 bg-paper-cream/30 min-h-[300px]">
          <pre className="font-mono text-sm text-ink-navy whitespace-pre-wrap leading-relaxed font-normal">
            {meeting.rawTranscript}
          </pre>
        </div>
      </div>

      <div className="mt-8 border-t border-muted-sage/20 pt-8">
        <Link
          to="/"
          className="border border-ink-navy text-ink-navy px-4 py-2 text-sm font-semibold hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 inline-block cursor-pointer"
        >
          &larr; Return to Ledger
        </Link>
      </div>
    </div>
  );
}
