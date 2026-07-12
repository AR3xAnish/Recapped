import { useContext } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Highlight } from "../App";

export default function Landing() {
  const { user, loading } = useContext(AuthContext);

  // If loading authority, display quiet ledger state log
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-8 text-center font-mono text-xs text-muted-sage">
        <span>[ Loading Ledger Authority... ]</span>
      </div>
    );
  }

  // Redirect authenticated users to the dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-8 flex flex-col space-y-16">
      {/* Hero Section */}
      <div className="py-12 text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-black text-ink-navy tracking-tight leading-tight max-w-3xl mx-auto font-sans">
          Turn meeting transcripts into decisions and action items — automatically
        </h1>
        <p className="text-base text-muted-sage max-w-xl mx-auto leading-relaxed">
          A minimalist digitized meeting ledger. Paste text transcripts, parse commitments, organize Kanbans, and sync action items straight to your Notion workspace.
        </p>
        <div className="pt-4 flex justify-center items-center gap-4">
          <Link
            to="/register"
            className="border border-ink-navy bg-ink-navy text-paper-cream px-8 py-3.5 text-sm font-bold uppercase tracking-wider hover:bg-transparent hover:text-ink-navy transition-colors duration-150 inline-block cursor-pointer"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="border border-ink-navy text-ink-navy px-8 py-3.5 text-sm font-bold uppercase tracking-wider hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 inline-block cursor-pointer"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Signature Visual Moment */}
      <div className="border border-muted-sage/30 p-8 bg-paper-cream/30 space-y-4">
        <div className="flex justify-between items-center text-[10px] font-mono text-muted-sage border-b border-muted-sage/20 pb-3">
          <span>EXCERPT REGISTRY SYSTEM LOG: REG_EXAMPLE_TRANSCRIPT</span>
          <span>TRANSCRIPT SYNTAX</span>
        </div>
        <pre className="font-mono text-sm text-ink-navy whitespace-pre-wrap leading-relaxed">
          [00:12:31] Alice: I will double-check the server deploy by Wednesday.{"\n"}
          [00:12:45] Bob: I will test the routes. We need to <Highlight>finalize the API spec</Highlight> first.{"\n"}
          [00:13:02] Alice: Understood. Let&apos;s <Highlight>push the production build</Highlight> after tests pass.
        </pre>
      </div>

      {/* How It Works Section */}
      <div className="py-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage mb-8 text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 border-t border-muted-sage/20 pt-8">
          <div className="space-y-2 md:px-4 md:border-r border-muted-sage/20 last:border-r-0">
            <h3 className="font-mono text-xs uppercase font-bold text-ink-navy">
              1. Upload transcript
            </h3>
            <p className="text-sm text-muted-sage leading-relaxed">
              Paste raw text logs or upload document formats directly. Whisper integration handles voice recordings.
            </p>
          </div>
          <div className="space-y-2 md:px-4 md:border-r border-muted-sage/20 last:border-r-0">
            <h3 className="font-mono text-xs uppercase font-bold text-ink-navy">
              2. Extract action items
            </h3>
            <p className="text-sm text-muted-sage leading-relaxed">
              AI automatically extracts participating scribes, key decisions, and action item commitments.
            </p>
          </div>
          <div className="space-y-2 md:px-4">
            <h3 className="font-mono text-xs uppercase font-bold text-ink-navy">
              3. Q&A or Notion export
            </h3>
            <p className="text-sm text-muted-sage leading-relaxed">
              Query transcript details via RAG vector search, or push parsed action tasks directly to Notion pages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
