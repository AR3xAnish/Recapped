import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { upload } from "@vercel/blob/client";
import api from "../services/api";

export default function NewMeeting() {
  const [activeTab, setActiveTab] = useState("paste"); // "paste" | "upload" | "audio"
  const [title, setTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingToGCS, setUploadingToGCS] = useState(false);

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

    if (activeTab === "audio") {
      if (ext !== "mp3" && ext !== "m4a" && ext !== "wav") {
        setError("Invalid file type. Only .mp3, .m4a, and .wav files are supported.");
        setFile(null);
        return;
      }
      // Enforce 50 MB limit for GCS direct audio uploads
      const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
      if (selectedFile.size > MAX_AUDIO_BYTES) {
        setError(
          `Audio file is too large (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB). Maximum supported audio file size is 50 MB.`
        );
        setFile(null);
        return;
      }
    } else {
      if (ext !== "txt" && ext !== "docx" && ext !== "pdf") {
        setError("Invalid file type. Only .txt, .docx, and .pdf files are supported.");
        setFile(null);
        return;
      }
      // Enforce 4.0 MB limit for direct document uploads to prevent Vercel 413 Gateway errors
      const MAX_DOC_BYTES = 4.0 * 1024 * 1024;
      if (selectedFile.size > MAX_DOC_BYTES) {
        setError(
          `Document file is too large (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB). Due to serverless platform payload size limits, document uploads are capped at 4.0 MB.`
        );
        setFile(null);
        return;
      }
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
        setError("Please select or drop a file.");
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
      } else if (activeTab === "audio") {
        setUploadingToGCS(true);
        setUploadProgress(0);

        let blob;
        try {
          blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: `${import.meta.env.VITE_API_URL || ""}/api/meetings/upload-url${localStorage.getItem("token") ? `?token=${encodeURIComponent(localStorage.getItem("token"))}` : ""}`,
            onUploadProgress: (progressEvent) => {
              setUploadProgress(progressEvent.percentage);
            },
          });
        } catch (uploadErr) {
          console.error("Vercel Blob direct upload failed:", uploadErr);
          throw new Error("Failed to upload audio file to Vercel Blob: " + uploadErr.message);
        }

        setUploadingToGCS(false);

        response = await api.post("/meetings", {
          title,
          blobUrl: blob.url,
          originalName: file.name,
          mimeType: file.type || "audio/mpeg",
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
      setError(
        err.response?.data?.error || err.message || "Failed to create meeting registry entry."
      );
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
        <p className="text-muted-sage mt-2 text-sm leading-relaxed max-w-xl font-sans">
          Pasted text, raw document sheets, or audio files will be loaded into the commitments
          database scoped to your active session.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 mb-8 text-xs font-mono">
          ENTRY ERROR: {error}
        </div>
      )}

      {/* Ledger Tabs */}

      <div className="flex flex-wrap border-b border-muted-sage/20 mb-8 font-sans">
        <button
          type="button"
          onClick={() => {
            setActiveTab("audio");
            setFile(null);
            setError(null);
          }}
          className={`px-6 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors duration-150 cursor-pointer ${
            activeTab === "audio"
              ? "border-ink-navy text-ink-navy"
              : "border-transparent text-muted-sage hover:text-ink-navy"
          }`}
        >
          [ Upload Audio ]
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("paste");
            setFile(null);
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
            setFile(null);
            setError(null);
          }}
          className={`px-6 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors duration-150 cursor-pointer ${
            activeTab === "upload"
              ? "border-ink-navy text-ink-navy"
              : "border-transparent text-muted-sage hover:text-ink-navy"
          }`}
        >
          [ Upload Document ]
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
        ) : activeTab === "upload" ? (
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Transcript Document File (.txt, .docx, .pdf)
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
              <label htmlFor="file-upload" className="cursor-pointer block font-sans">
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-ink-navy block">
                    {file ? `Selected: ${file.name}` : "Drag and drop document file here"}
                  </span>
                  <span className="text-xs text-muted-sage font-mono block">
                    {file
                      ? `(${(file.size / 1024).toFixed(1)} KB)`
                      : "or click to select document from disk"}
                  </span>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Transcript Audio File
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
                id="audio-upload"
                accept=".mp3,.m4a,.wav"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="audio-upload" className="cursor-pointer block font-sans">
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-ink-navy block">
                    {file ? `Selected: ${file.name}` : "Drag and drop audio file here"}
                  </span>
                  <span className="text-xs text-muted-sage font-mono block">
                    {file
                      ? `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`
                      : "or click to select audio from disk (max 50MB)"}
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="pt-4">
          {uploadingToGCS && (
            <div className="mb-4">
              <div className="flex justify-between items-center text-xs font-mono text-muted-sage mb-1">
                <span>UPLOADING TO STORAGE:</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-paper-cream border border-muted-sage/30 h-2 rounded-none overflow-hidden">
                <div
                  className="bg-ink-navy h-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-ink-navy text-ink-navy py-3 text-sm font-bold tracking-wide hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? uploadingToGCS
                ? `UPLOADING TO CLOUD (${uploadProgress}%)...`
                : activeTab === "audio"
                  ? "TRANSCRIBING YOUR AUDIO..."
                  : "RECORDING ENTRY..."
              : "COMMIT TO LEDGER"}
          </button>
        </div>
      </form>
    </div>
  );
}
