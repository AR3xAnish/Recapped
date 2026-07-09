import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      login(response.data.token, response.data.user);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.error || "Connection to authorization server failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-24 px-8">
      <div className="border border-muted-sage/30 bg-paper-cream/40 p-8 shadow-sm">
        <div className="border-b border-muted-sage/30 pb-4 mb-6">
          <span className="text-xs font-mono text-muted-sage block">REGISTRY ENTRY // AUTH</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink-navy mt-1">
            Access Ledger
          </h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 mb-6 text-xs font-mono">
            ERROR: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-paper-cream border border-muted-sage/30 px-3 py-2 text-ink-navy focus:outline-none focus:border-ink-navy text-sm font-sans"
              required
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-sage block mb-2">
              Secret Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-paper-cream border border-muted-sage/30 px-3 py-2 text-ink-navy focus:outline-none focus:border-ink-navy text-sm font-sans"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-ink-navy text-ink-navy py-2 text-sm font-semibold hover:bg-ink-navy hover:text-paper-cream transition-colors duration-150 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "VERIFYING..." : "ENTER LEDGER"}
          </button>
        </form>

        <div className="border-t border-muted-sage/30 mt-6 pt-4 text-center">
          <span className="text-xs text-muted-sage font-sans">
            New scribe?{" "}
            <Link
              to="/register"
              className="text-ink-navy font-bold underline hover:text-muted-sage transition-colors duration-150"
            >
              Register here
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
