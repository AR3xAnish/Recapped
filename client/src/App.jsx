import { useState, useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import api from "./services/api";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Signature Reusable Highlight Component
export function Highlight({ children }) {
  return (
    <span className="bg-highlighter-gold text-[#121922] px-1.5 py-0.5 font-medium inline-block select-all">
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
              Ledger
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

// Dashboard component styled as a ruled ledger
function Dashboard() {
  const { user } = useContext(AuthContext);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  
  // Secure route test data
  const [secureMessage, setSecureMessage] = useState("");
  const [secureLoading, setSecureLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/health");
      setHealthStatus(response.data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || "Connection refused");
      setHealthStatus(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  const checkSecureRoute = async () => {
    setSecureLoading(true);
    try {
      const response = await api.get("/protected-test");
      setSecureMessage(response.data.message);
    } catch (err) {
      setSecureMessage(err.response?.data?.error || "Failed to query protected API");
    } finally {
      setSecureLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    checkSecureRoute();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-16 px-8">
      {/* Ledger Header */}
      <div className="pb-8 border-b border-muted-sage/30">
        <div className="flex items-center justify-between text-xs font-mono text-muted-sage">
          <span>PAGE NO: 01</span>
          <span>DATE: {new Date().toLocaleDateString()}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-navy mt-4 tracking-tight">
          Meeting Minutes & Commitments Ledger
        </h1>
        <p className="text-muted-sage mt-2 text-base max-w-xl font-normal leading-relaxed">
          A digitized meeting records interface. Key commitments, actions, and connections are recorded herein.
        </p>
      </div>

      {/* Scribe Access Verification Ruled Section */}
      <div className="py-8 border-b border-muted-sage/30 space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-2">
          Active Registry Session
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center text-sm font-mono border-b border-muted-sage/10 pb-2">
            <span className="text-muted-sage">SCRIBE_NAME:</span>
            <span className="text-ink-navy font-semibold">{user?.name}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-mono border-b border-muted-sage/10 pb-2">
            <span className="text-muted-sage">SCRIBE_EMAIL:</span>
            <span className="text-ink-navy font-semibold">{user?.email}</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-sm font-mono border-b border-muted-sage/10 pb-2 pt-2">
          <span className="text-muted-sage">SECURE_API_LINK:</span>
          <span className="text-ink-navy">
            {secureLoading ? (
              <span className="animate-pulse">Accessing...</span>
            ) : (
              <Highlight>{secureMessage}</Highlight>
            )}
          </span>
        </div>
      </div>

      {/* Health Check Ledger Ruled Section */}
      <div className="py-8 border-b border-muted-sage/30">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-6">
          System Verification Logs
        </h2>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <span className="text-xs font-mono text-muted-sage">LOG_01:</span>
              <span className="text-base font-semibold text-ink-navy">
                Backend Status Link
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {loading ? (
                <span className="text-xs font-mono text-muted-sage animate-pulse">
                  Querying server...
                </span>
              ) : error ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-muted-sage mr-2">Status:</span>
                  <span className="bg-red-100 text-red-800 px-2 py-0.5 text-xs font-mono uppercase tracking-wide">
                    Offline
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-muted-sage mr-2">Status:</span>
                  <Highlight>Backend Online</Highlight>
                </div>
              )}

              <button
                onClick={() => {
                  checkHealth();
                  checkSecureRoute();
                }}
                disabled={loading}
                className="border border-ink-navy text-ink-navy px-3 py-1.5 text-xs font-semibold hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 disabled:opacity-50 cursor-pointer"
              >
                Refresh Log
              </button>
            </div>
          </div>

          {/* Raw Log Details Rectangular Border */}
          <div className="border border-muted-sage/30 p-5 bg-paper-cream/40 font-mono text-xs">
            <div className="flex justify-between text-muted-sage border-b border-muted-sage/20 pb-2 mb-3">
              <span>METADATA</span>
              <span>VALUE</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-sage">Target URI:</span>
                <span className="text-ink-navy">
                  {import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/health
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-sage">Last Pinged:</span>
                <span className="text-ink-navy">{lastChecked || "Never"}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-sage">Response Data:</span>
                <span className="text-ink-navy font-semibold text-right max-w-md break-all">
                  {loading ? (
                    "..."
                  ) : error ? (
                    <span className="text-red-700">{error}</span>
                  ) : (
                    JSON.stringify(healthStatus)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="py-12">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-sage mb-6">
          Ledger Environment Metadata
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 border-t border-muted-sage/30 pt-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-1">
              Frontend Framework
            </span>
            <span className="text-base font-semibold text-ink-navy font-mono">
              React 19 + Vite
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-1">
              Styling Specification
            </span>
            <span className="text-base font-semibold text-ink-navy font-mono">
              Tailwind CSS v4
            </span>
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-1">
              State & Fetching
            </span>
            <span className="text-base font-semibold text-ink-navy font-mono">
              Router + Axios
            </span>
          </div>
        </div>
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
          About the Minutes Book Ledger
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
          className="border border-ink-navy text-ink-navy px-4 py-2 text-sm font-semibold hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 inline-block"
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
