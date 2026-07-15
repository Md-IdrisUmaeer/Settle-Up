import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/common/AppLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';

export default function Settings() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [blockingGroups, setBlockingGroups] = useState(null);

  const canConfirm = confirmText.trim().toLowerCase() === 'delete';

  async function handleDelete(e) {
    e.preventDefault();
    if (!canConfirm) return;

    setDeleting(true);
    setError(null);
    setBlockingGroups(null);
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not delete your account. Please try again.'
      );
      setBlockingGroups(err.response?.data?.groups || null);
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">Account settings</h1>

      <Card className="mt-6">
        <p className="text-sm text-ink-muted">Name</p>
        <p className="mt-1 text-sm text-ink">{user?.name}</p>
        <p className="mt-4 text-sm text-ink-muted">Email</p>
        <p className="mt-1 text-sm text-ink">{user?.email}</p>
      </Card>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-debt">Delete account</h2>
        <Card className="mt-3 border-debt/30">
          <p className="text-sm text-ink-muted">
            This permanently deletes your account. You won't be able to log in again, and your
            name/email will be removed from any groups you're still in.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>You must be settled up (₹0 balance) in every group first.</li>
            <li>
              If you own a group with other members, transfer ownership or delete that group
              first.
            </li>
          </ul>

          {error && (
            <div className="mt-4 rounded-md bg-debt-bg px-3 py-2.5 text-sm text-debt">
              <p>{error}</p>
              {blockingGroups && blockingGroups.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {blockingGroups.map((g) => (
                    <li key={g.groupId}>
                      {g.groupName}
                      {typeof g.amount === 'number' &&
                        ` — ${g.amount > 0 ? 'you are owed' : 'you owe'} ₹${Math.abs(
                          g.amount
                        ).toFixed(2)}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <form onSubmit={handleDelete} className="mt-5 border-t border-sand pt-4">
            <TextField
              id="confirmDelete"
              label={'Type "delete" to confirm'}
              placeholder="delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="submit"
              className="mt-4 !bg-debt hover:!bg-debt/90"
              disabled={!canConfirm}
              loading={deleting}
            >
              Permanently delete my account
            </Button>
          </form>
        </Card>
      </section>
    </AppLayout>
  );
}
