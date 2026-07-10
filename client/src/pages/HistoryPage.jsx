import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Highlight } from "../App";

export default function HistoryPage() {
  const navigate = useNavigate();
  
  // Query params state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("date");
  const [limit] = useState(10); // Standard limit

  const [meetings, setMeetings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/meetings", {
        params: {
          page,
          limit,
          search: debouncedSearch,
          sortBy,
        },
      });
      setMeetings(response.data.meetings);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch meeting history logs.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRowClick = (meetingId) => {
    navigate(`/meetings/${meetingId}`);
  };

  return (
    <div className="max-w-5xl mx-auto py-16 px-8">
      {/* History Header */}
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>HISTORY REGISTRY</span>
          <span>TOTAL LOGS: {pagination.total}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          Historical Meeting minutes
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed">
          A list of all digitized meeting records. Query logs by search string or organize by sorting filters.
        </p>

        {/* Query Controls */}
        <div className="flex flex-col md:flex-row gap-4 mt-8 p-5 border border-muted-sage/20 bg-paper-cream/40 text-xs font-mono items-end">
          <div className="flex flex-col space-y-1.5 flex-grow w-full">
            <label className="text-[10px] text-muted-sage uppercase">Search ledger logs (matches title/participant)</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type title or participant name..."
              className="bg-transparent border border-muted-sage/30 text-ink-navy px-3 py-2 outline-none font-sans text-sm focus:border-ink-navy"
            />
          </div>

          <div className="flex flex-col space-y-1.5 min-w-[180px] w-full md:w-auto">
            <label className="text-[10px] text-muted-sage uppercase">Sort order</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border border-muted-sage/30 text-ink-navy px-3 py-2 outline-none cursor-pointer focus:border-ink-navy font-sans text-sm"
            >
              <option value="date">Newest First</option>
              <option value="title">Alphabetical (Title)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 text-xs font-mono mb-8">
          HISTORY ERROR: {error}
        </div>
      )}

      {/* Ledger Table */}
      <div className="border border-muted-sage/30 bg-paper-cream/40 p-5 overflow-x-auto min-h-[300px]">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center font-mono text-xs text-muted-sage">
            [ Querying logs... ]
          </div>
        ) : meetings.length > 0 ? (
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="text-muted-sage border-b border-muted-sage/20 pb-2">
                <th className="pb-2 font-mono font-normal">MEETING TITLE</th>
                <th className="pb-2 font-mono font-normal">DATE RECORDED</th>
                <th className="pb-2 font-mono font-normal">STATUS</th>
                <th className="pb-2 font-mono font-normal text-center">PARTICIPANTS</th>
                <th className="pb-2 font-mono font-normal text-right">ACTION ITEMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-sage/10 text-ink-navy cursor-pointer">
              {meetings.map((meeting) => (
                <tr
                  key={meeting._id}
                  onClick={() => handleRowClick(meeting._id)}
                  className="hover:bg-ink-navy/5 transition-colors duration-150"
                >
                  <td className="py-3 pr-4 font-sans text-sm font-semibold text-ink-navy">
                    {meeting.title}
                  </td>
                  <td className="py-3 pr-4 text-muted-sage">
                    {new Date(meeting.date).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <Highlight>{meeting.status}</Highlight>
                  </td>
                  <td className="py-3 text-center text-ink-navy font-bold">
                    {meeting.participantCount}
                  </td>
                  <td className="py-3 text-right text-ink-navy font-bold">
                    {meeting.actionItemCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-[200px] flex items-center justify-center font-mono text-xs text-muted-sage/50">
            [ No matching ledger entries found ]
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center mt-8 text-xs font-mono text-muted-sage">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="border border-ink-navy text-ink-navy px-3 py-1.5 hover:bg-ink-navy hover:text-paper-cream disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-navy cursor-pointer transition-colors duration-150"
          >
            &larr; Previous Page
          </button>
          
          <span>
            PAGE {page} OF {pagination.pages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
            disabled={page === pagination.pages}
            className="border border-ink-navy text-ink-navy px-3 py-1.5 hover:bg-ink-navy hover:text-paper-cream disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-navy cursor-pointer transition-colors duration-150"
          >
            Next Page &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
