import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-cream dark:bg-[#121922] text-ink-navy flex items-center justify-center font-mono text-sm p-8 transition-colors duration-300">
        <span>[ Querying ledger registry... ]</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
