import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import { Highlight } from "../App";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState({
    connected: false,
    databaseId: null,
    databaseName: null,
  });
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const fetchDatabases = useCallback(async () => {
    setDbLoading(true);
    try {
      const response = await api.get("/integrations/notion/databases");
      setDatabases(response.data);
    } catch (err) {
      if (err.response?.data?.code === "NOTION_UNAUTHORIZED") {
        setError("Notion connection has expired. Please reconnect.");
        setStatus({ connected: false, databaseId: null, databaseName: null });
      } else {
        setError(err.response?.data?.error || "Failed to load Notion databases.");
      }
    } finally {
      setDbLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get("/integrations/notion/status");
      setStatus(response.data);
    } catch (err) {
      console.error("Failed to query integration status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (successParam === "notion_connected") {
      setSuccessMsg("Successfully connected to Notion!");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams, fetchStatus]);

  const handleConnect = async () => {
    setError(null);
    try {
      const response = await api.post("/integrations/notion/connect");
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to initiate connection.");
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await api.delete("/integrations/notion/disconnect");
      setStatus({ connected: false, databaseId: null, databaseName: null });
      setDatabases([]);
      setSuccessMsg("Disconnected from Notion.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to disconnect.");
    }
  };

  const handleSelectDatabase = async (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    setError(null);
    const selectedDb = databases.find((db) => db.id === selectedId);
    const dbName = selectedDb ? selectedDb.title : "Selected Database";

    try {
      await api.post("/integrations/notion/database", {
        databaseId: selectedId,
        databaseName: dbName,
      });
      setStatus((prev) => ({ ...prev, databaseId: selectedId, databaseName: dbName }));
      setSuccessMsg(`Database set to "${dbName}"`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to select database.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-8 text-center font-mono text-xs text-muted-sage">
        <span>[ Fetching integration settings logs... ]</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      {/* Settings Header */}
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>PAGE NO: 03</span>
          <span>DATE: {new Date().toLocaleDateString()}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          Integration settings sheet
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed font-sans">
          Configure third-party integrations and export targets for meeting commitments.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 p-4 mb-8 text-xs font-mono">
          SUCCESS: {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 mb-8 text-xs font-mono">
          SETTINGS ERROR: {error}
        </div>
      )}

      {/* Notion Integration Card Block */}
      <div className="border border-muted-sage/30 p-8 bg-paper-cream/40 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-muted-sage/20 pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink-navy">Notion Workspace Integration</h2>
            <p className="text-xs text-muted-sage font-mono mt-1">PROVIDER ID: notion</p>
          </div>
          <div className="mt-4 md:mt-0 font-mono text-xs">
            {status.connected ? (
              <span className="bg-emerald-100 text-emerald-800 px-3 py-1 font-semibold uppercase tracking-wide">
                Connected
              </span>
            ) : (
              <span className="bg-ink-navy/5 border border-muted-sage/30 text-ink-navy px-3 py-1 uppercase tracking-wide">
                Disconnected
              </span>
            )}
          </div>
        </div>

        {status.connected ? (
          <div className="space-y-6">
            <p className="text-sm text-ink-navy leading-relaxed font-sans">
              Recapped is authorized to read pages and write action item logs to your shared databases in Notion.
            </p>

            <div className="flex flex-col space-y-4 p-5 border border-muted-sage/20 bg-paper-cream/60 font-mono text-xs text-ink-navy">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-sage uppercase block">Export Target</span>
                  <span className="text-sm font-semibold mt-1 font-sans">
                    {status.databaseId ? (
                      <>Exporting to: <Highlight>{status.databaseName || "Recapped Action Items"}</Highlight> in Notion</>
                    ) : (
                      <span className="text-amber-700 animate-pulse">[ Provisioning Recapped Action Items database... ]</span>
                    )}
                  </span>
                </div>
                {status.databaseId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPicker(!showPicker);
                      if (!showPicker && databases.length === 0) {
                        fetchDatabases();
                      }
                    }}
                    className="text-[10px] underline text-ink-navy font-bold uppercase hover:text-muted-sage cursor-pointer ml-4"
                  >
                    {showPicker ? "Cancel" : "Change database"}
                  </button>
                )}
              </div>

              {showPicker && (
                <div className="pt-4 border-t border-muted-sage/10 flex flex-col space-y-2">
                  <label className="text-[10px] text-muted-sage uppercase">Select Custom Database Target</label>
                  {dbLoading ? (
                    <span className="text-muted-sage animate-pulse">Loading workspace databases...</span>
                  ) : databases.length > 0 ? (
                    <select
                      value={status.databaseId || ""}
                      onChange={handleSelectDatabase}
                      className="bg-transparent border border-muted-sage/30 text-ink-navy px-3 py-2 outline-none cursor-pointer focus:border-ink-navy font-sans text-sm max-w-md"
                    >
                      <option value="" disabled>— Select Workspace Database —</option>
                      {databases.map((db) => (
                        <option key={db.id} value={db.id}>{db.title}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-red-700 font-sans text-xs">No databases found. Share another database with the integration.</span>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end items-center border-t border-muted-sage/20">
              <button
                type="button"
                onClick={handleDisconnect}
                className="border border-red-700 text-red-700 px-4 py-2 text-xs font-semibold uppercase hover:bg-red-700 hover:text-paper-cream transition-colors duration-150 cursor-pointer"
              >
                Disconnect Notion
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-sage leading-relaxed font-sans">
              Connect your Notion workspace to dynamically export extracted meeting minutes, action items, owner assignments, and deadlines as structured pages.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleConnect}
                className="border border-ink-navy text-ink-navy px-6 py-3 text-sm font-bold tracking-wide hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer"
              >
                CONNECT NOTION ACCOUNT
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link to="/" className="text-ink-navy font-bold underline hover:text-muted-sage text-sm font-mono">
          &larr; Return to Home
        </Link>
      </div>
    </div>
  );
}
