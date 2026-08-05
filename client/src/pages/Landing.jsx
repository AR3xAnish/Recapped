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
              3. Slack & Notion Sync
            </h3>
            <p className="text-sm text-muted-sage leading-relaxed">
              Export parsed action tasks directly to Notion databases, or post recap summaries instantly to Slack channels.
            </p>
          </div>
        </div>
      </div>

      {/* Notion & Slack Integrations Overview */}
      <div className="py-8 border-t border-muted-sage/20">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage mb-8 text-center">
          Connected Workspaces
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Notion Card */}
          <div className="border border-muted-sage/30 p-6 bg-paper-cream/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-sage border-b border-muted-sage/20 pb-2 mb-4">
                <span>WORKSPACE INTEGRATION</span>
                <span>NOTION</span>
              </div>
              <h3 className="text-base font-bold text-ink-navy">
                Sync Action Items to Notion Databases
              </h3>
              <p className="text-sm text-muted-sage mt-2 leading-relaxed font-sans">
                Connect your workspace to push meeting commitments directly into your team databases.
              </p>
              <ul className="mt-4 space-y-2 text-xs font-mono text-ink-navy">
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 1. Click &quot;Connect Notion&quot; in Settings
                </li>
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 2. Choose pages to share with Recapped
                </li>
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 3. Click &quot;Export&quot; on any action item
                </li>
              </ul>
            </div>
            <div className="text-[10px] text-muted-sage font-mono bg-paper-cream/60 p-2 border border-muted-sage/10 rounded">
              ✓ Database auto-created on connection.
            </div>
          </div>

          {/* Slack Card */}
          <div className="border border-muted-sage/30 p-6 bg-paper-cream/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-sage border-b border-muted-sage/20 pb-2 mb-4">
                <span>CHAT CLIENT CONNECTION</span>
                <span>SLACK</span>
              </div>
              <h3 className="text-base font-bold text-ink-navy">
                Stream Recaps to Slack Channels
              </h3>
              <p className="text-sm text-muted-sage mt-2 leading-relaxed font-sans">
                Send automated action item summaries and follow-ups straight to your communication channels.
              </p>
              <ul className="mt-4 space-y-2 text-xs font-mono text-ink-navy">
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 1. Click &quot;Connect Slack&quot; in Settings
                </li>
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 2. Pick your default target channel
                </li>
                <li className="flex items-center">
                  <span className="text-highlighter-gold mr-2">▶</span> 3. Recaps post automatically on process
                </li>
              </ul>
            </div>
            <div className="text-[10px] text-muted-sage font-mono bg-paper-cream/60 p-2 border border-muted-sage/10 rounded">
              ✓ No manual slash invites required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
