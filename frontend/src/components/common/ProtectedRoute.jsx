import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sage border-t-clay-dark" />
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
