import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from './Button';

export default function AppLayout({ children, wide = false }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sand bg-white">
        <div
          className={`mx-auto flex items-center justify-between px-6 py-4 ${
            wide ? 'max-w-7xl' : 'max-w-3xl'
          }`}
        >
          <Link to="/groups" className="font-display text-xl font-semibold text-ink">
            SettleUp
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-muted">{user?.name}</span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-6 py-8 ${wide ? 'max-w-7xl' : 'max-w-3xl'}`}>{children}</main>
    </div>
  );
}
