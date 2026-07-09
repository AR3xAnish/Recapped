import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function NewMeeting() {
  const [activeTab, setActiveTab] = useState("paste"); // "paste" | "upload"
  const [title, setTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    setError(null);
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    if (ext !== "txt" && ext !== "docx" && ext !== "pdf") {
      setError("Invalid file type. Only .txt, .docx, and .pdf files are supported.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
    if (!title) {
      const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf("."));
      setTitle(nameWithoutExt);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (activeTab === "paste") {
      if (!title.trim() || !transcriptText.trim()) {
        setError("Both title and transcript text are required.");
        return;
      }
    } else {
      if (!file) {
        setError("Please select or drop a transcript file.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let response;
      if (activeTab === "paste") {
        response = await api.post("/meetings", {
          title,
          transcriptText,
        });
      } else {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("file", file);
        response = await api.post("/meetings", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }
      navigate(`/meetings/${response.data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create meeting registry entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-16 px-8">
      <div className="pb-8 border-b border-muted-sage/30 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>NEW ENTRY</span>
          <span>REGISTRY NO: AUTO</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          Record Meeting Transcript
        </h1>
        <p className="text-muted-sage mt-2 text-sm leading-relaxed max-w-xl">
          Pasted text or raw text files will be loaded into the commitments database scoped to your active session.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 mb-8 text-xs font-mono">
          ENTRY ERROR: {error}
        </div>
      )}

      {/* Ledger Tabs */}
      <div className="flex border-b border-muted-sage/20 mb-8 font-sans">
        <button
          type="button"
          onClick={() => {
            setActiveTab("paste");
            setError(null);
          }}
          className={`px-6 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors duration-150 cursor-pointer ${
            activeTab === "paste"
              ? "border-ink-navy text-ink-navy"
              : "border-transparent text-muted-sage hover:text-ink-navy"
          }`}
        >
          [ Paste Transcript ]
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
          className={`px-6 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors duration-150 cursor-pointer ${
            activeTab === "upload"
              ? "border-ink-navy text-ink-navy"
              : "border-transparent text-muted-sage hover:text-ink-navy"
          }`}
        >
          [ Upload File ]
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
            Meeting Title / Descriptor
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Synced Review"
            className="w-full bg-paper-cream border border-muted-sage/30 px-4 py-2.5 text-ink-navy focus:outline-none focus:border-ink-navy text-sm font-sans"
            required
          />
        </div>

        {activeTab === "paste" ? (
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Transcript Content (Text Only)
            </label>
            <textarea
              rows={12}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste lines of transcript here..."
              className="w-full bg-paper-cream border border-muted-sage/30 p-4 text-ink-navy focus:outline-none focus:border-ink-navy text-sm font-mono leading-relaxed"
              required
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Transcript File (.txt, .docx, .pdf)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-none p-12 text-center transition-colors duration-150 relative ${
                dragActive
                  ? "border-ink-navy bg-ink-navy/5"
                  : "border-muted-sage/30 hover:border-ink-navy bg-paper-cream/30"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".txt,.docx,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-ink-navy block">
                    {file ? `Selected: ${file.name}` : "Drag and drop transcript file here"}
                  </span>
                  <span className="text-xs text-muted-sage font-mono block">
                    {file ? `(${(file.size / 1024).toFixed(1)} KB)` : "or click to select file from disk"}
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-ink-navy text-ink-navy py-3 text-sm font-bold tracking-wide hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "RECORDING ENTRY..." : "COMMIT TO LEDGER"}
          </button>
        </div>
      </form>
    </div>
  );
}
