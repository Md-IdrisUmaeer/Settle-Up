import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import GroupList from './pages/GroupList';
import GroupDetail from './pages/GroupDetail';
import AddExpense from './pages/AddExpense';
import InvitePage from './pages/InvitePage';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* Public: works for logged-out visitors too, see InvitePage.jsx */}
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId/expenses/new"
            element={
              <ProtectedRoute>
                <AddExpense />
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
          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
