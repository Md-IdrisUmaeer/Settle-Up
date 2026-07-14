import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as groupsApi from '../api/groups';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';

export const PENDING_INVITE_KEY = 'settleup_pending_invite';

/**
 * Public landing page for an invite link (/invite/:inviteCode). Works for
 * both existing and brand-new users:
 *  - Logged in already -> straight "Join group" button.
 *  - Not logged in -> offers signup/login, stashing the invite code so it
 *    can be redeemed automatically right after auth completes (see
 *    Signup.jsx / Login.jsx).
 */
export default function InvitePage() {
  const { inviteCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null); // { name, memberCount }
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    groupsApi
      .previewInvite(inviteCode)
      .then(setPreview)
      .catch((err) =>
        setError(err.response?.data?.message || 'This invite link is invalid or has expired.')
      );
  }, [inviteCode]);

  function continueToAuth(path) {
    localStorage.setItem(PENDING_INVITE_KEY, inviteCode);
    navigate(path);
  }

  async function joinNow() {
    setJoining(true);
    setError(null);
    try {
      const group = await groupsApi.joinByInviteCode(inviteCode);
      navigate(`/groups/${group._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join this group.');
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">SettleUp</h1>
        </div>

        <div className="rounded-lg border border-sand bg-white p-6 text-center shadow-sm">
          {error && (
            <>
              <p className="text-ink">{error}</p>
              <Link
                to="/groups"
                className="mt-4 inline-block text-sm font-medium text-clay-dark hover:underline"
              >
                Go to your groups
              </Link>
            </>
          )}

          {!error && !preview && (
            <div className="space-y-3">
              <Skeleton className="mx-auto h-4 w-2/3" />
              <Skeleton className="mx-auto h-3 w-1/2" />
            </div>
          )}

          {!error && preview && (
            <>
              <p className="text-sm text-ink-muted">You've been invited to join</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{preview.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} so far
              </p>

              <div className="mt-6 space-y-2">
                {authLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : user ? (
                  <Button className="w-full" loading={joining} onClick={joinNow}>
                    Join {preview.name}
                  </Button>
                ) : (
                  <>
                    <Button className="w-full" onClick={() => continueToAuth('/signup')}>
                      Create account to join
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => continueToAuth('/login')}
                    >
                      I already have an account
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
