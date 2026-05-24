import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const { loading, user, isConfigured } = useAuth();

  if (!isConfigured) {
    return children;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 text-brand-800">
        Loading your workspace...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}
