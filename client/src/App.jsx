import { useState, useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import api from "./services/api";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NewMeeting from "./pages/NewMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import Board from "./pages/Board";
import HistoryPage from "./pages/HistoryPage";
import Settings from "./pages/Settings";

// Signature Reusable Highlight Component
export function Highlight({ children }) {
  return (
    <span className="bg-highlighter-gold text-[#121922] px-1.5 py-0.5 font-medium inline-block select-all font-sans">
      {children}
    </span>
  );
}

// Navigation Bar
function Navigation({ isDark, setIsDark }) {
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-paper-cream border-b border-muted-sage/20 px-8 py-6 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center space-x-2">
        <span className="text-2xl font-black tracking-tight text-ink-navy">
          Recapped
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-sage font-mono border border-muted-sage/30 px-1.5 py-0.5">
          Ledger v1.0
        </span>
      </div>
      <div className="flex items-center space-x-8">
        {user && (
          <>
            <Link
              to="/"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              Home
            </Link>
            <Link
              to="/meetings/new"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/meetings/new") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              New Entry
            </Link>
            <Link
              to="/board"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/board") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              Board
            </Link>
            <Link
              to="/history"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/history") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              History
            </Link>
            <Link
              to="/settings"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/settings") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              Settings
            </Link>
            <Link
              to="/about"
              className={`transition-colors duration-200 text-sm font-semibold tracking-wide ${
                isActive("/about") ? "text-ink-navy border-b-2 border-ink-navy pb-1" : "text-muted-sage hover:text-ink-navy"
              }`}
            >
              About Ledger
            </Link>
            <span className="text-xs font-mono text-muted-sage hidden md:inline">
              SCRIBE: <span className="text-ink-navy font-semibold">[{user.name}]</span>
            </span>
            <button
              onClick={logout}
              className="border border-ink-navy text-ink-navy px-2.5 py-1 text-xs font-mono uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer"
            >
              Logout
            </button>
          </>
        )}
        <button
          onClick={() => setIsDark(!isDark)}
          className="border border-ink-navy text-ink-navy px-2.5 py-1 text-xs font-mono uppercase hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer"
        >
          Mode: {isDark ? "Dark" : "Light"}
        </button>
      </div>
    </nav>
  );
}

// Clean Dashboard Home component with quick shortcuts and recent logs
function Dashboard() {
  const { user } = useContext(AuthContext);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const response = await api.get("/meetings", { params: { limit: 5 } });
        setRecentMeetings(response.data.meetings);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load recent logs.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      {/* Header */}
      <div className="pb-8 border-b border-muted-sage/30">
        <h1 className="text-3xl font-extrabold text-ink-navy tracking-tight">
          Welcome, {user?.name}
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed">
          Recapped is your digitized meeting ledger. Capture transcript logs, analyze commitments, and manage action items.
        </p>
      </div>

      {/* Quick Actions Shortcuts */}
      <div className="py-8 border-b border-muted-sage/30">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage mb-4">
          Quick ledger commands
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/meetings/new"
            className="border border-ink-navy text-ink-navy p-6 hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 text-center cursor-pointer"
          >
            <span className="block font-mono text-xs uppercase tracking-wider text-muted-sage mb-2">Command 01</span>
            <span className="text-base font-bold">[ Record New Entry ]</span>
          </Link>
          
          <Link
            to="/board"
            className="border border-ink-navy text-ink-navy p-6 hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 text-center cursor-pointer"
          >
            <span className="block font-mono text-xs uppercase tracking-wider text-muted-sage mb-2">Command 02</span>
            <span className="text-base font-bold">[ View Action Board ]</span>
          </Link>

          <Link
            to="/history"
            className="border border-ink-navy text-ink-navy p-6 hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 text-center cursor-pointer"
          >
            <span className="block font-mono text-xs uppercase tracking-wider text-muted-sage mb-2">Command 03</span>
            <span className="text-base font-bold">[ Browse History ]</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="py-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-sage mb-6">
          Recent ledger records
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-4 text-xs font-mono mb-4">
            ERROR LOADING RECORDS: {error}
          </div>
        )}

        {loading ? (
          <div className="text-xs font-mono text-muted-sage py-8">[ Querying records... ]</div>
        ) : recentMeetings.length > 0 ? (
          <div className="border border-muted-sage/30 bg-paper-cream/40 p-5">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="text-muted-sage border-b border-muted-sage/20 pb-2">
                  <th className="pb-2 font-mono font-normal">MEETING TITLE</th>
                  <th className="pb-2 font-mono font-normal">DATE RECORDED</th>
                  <th className="pb-2 font-mono font-normal text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-sage/10 text-ink-navy">
                {recentMeetings.map((meeting) => (
                  <tr key={meeting._id} className="hover:bg-ink-navy/5 transition-colors duration-150">
                    <td className="py-3 pr-4 font-sans text-sm font-semibold">
                      <Link to={`/meetings/${meeting._id}`} className="hover:underline">
                        {meeting.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-sage">
                      {new Date(meeting.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <Highlight>{meeting.status}</Highlight>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs font-mono text-muted-sage/60 italic py-8">
            [ No meeting records exist in the ledger database. ]
          </div>
        )}
      </div>
    </div>
  );
}

// Simple About Scaffold Component
function About() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      {/* Ledger Header */}
      <div className="pb-8 border-b border-muted-sage/30">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>PAGE NO: 02</span>
          <span>DATE: {new Date().toLocaleDateString()}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          About the Recapped Ledger
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed">
          Technical ledger metadata and configurations for the scaffold.
        </p>
      </div>

      <div className="py-8 border-b border-muted-sage/30 space-y-6">
        <p className="text-ink-navy text-base leading-relaxed">
          The Recapped application scaffolding uses thin horizontal ruled separators and flat geometric boundaries to organize technical logs and connection verification.
        </p>

        <div className="space-y-4">
          <div className="flex items-start">
            <span className="text-muted-sage font-mono mr-3">ITEM_01:</span>
            <div>
              <strong className="text-ink-navy block">Client Architecture</strong>
              <span className="text-muted-sage text-sm">
                Vite client structured with React Router and Axios inside <span className="font-mono text-xs">/client</span>.
              </span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-muted-sage font-mono mr-3">ITEM_02:</span>
            <div>
              <strong className="text-ink-navy block">Server Architecture</strong>
              <span className="text-muted-sage text-sm">
                Node.js Express backend organized under routes, controllers, models, and middleware inside <span className="font-mono text-xs">/server</span>.
              </span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-muted-sage font-mono mr-3">ITEM_03:</span>
            <div>
              <strong className="text-ink-navy block">Shared Task Runner</strong>
              <span className="text-muted-sage text-sm">
                A root package manager using <span className="font-mono text-xs">concurrently</span> to boot up both servers simultaneously.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
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

// Root Application Layout
function AppContent({ isDark, setIsDark }) {
  return (
    <div className="min-h-screen bg-paper-cream text-ink-navy flex flex-col font-sans antialiased transition-colors duration-300">
      <Navigation isDark={isDark} setIsDark={setIsDark} />
      <main className="flex-grow">
        <Routes>
          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board"
            element={
              <ProtectedRoute>
                <Board />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meetings/new"
            element={
              <ProtectedRoute>
                <NewMeeting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meetings/:id"
            element={
              <ProtectedRoute>
                <MeetingDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <About />
              </ProtectedRoute>
            }
          />

          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
      <footer className="bg-paper-cream border-t border-muted-sage/20 py-8 text-center text-xs font-mono text-muted-sage transition-colors duration-300">
        Recapped Ledger Registry &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <AuthProvider>
      <Router>
        <AppContent isDark={isDark} setIsDark={setIsDark} />
      </Router>
    </AuthProvider>
  );
}
