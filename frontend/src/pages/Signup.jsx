import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';
import * as groupsApi from '../api/groups';
import { PENDING_INVITE_KEY } from './InvitePage';
import { isNonEmptyString, isValidEmail } from '../utils/validation';

export default function Signup() {
  const { signup, error } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const pendingInvite =
    typeof window !== 'undefined' ? localStorage.getItem(PENDING_INVITE_KEY) : null;

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError(null);

    if (!isNonEmptyString(form.name, { max: 80 })) {
      setLocalError('Enter your name.');
      return;
    }
    if (!isValidEmail(form.email)) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const ok = await signup(form);
    setSubmitting(false);
    if (!ok) return;

    // If they arrived here from an invite link, redeem it now and land
    // straight in that group instead of the generic groups list.
    if (pendingInvite) {
      localStorage.removeItem(PENDING_INVITE_KEY);
      try {
        const group = await groupsApi.joinByInviteCode(pendingInvite);
        navigate(`/groups/${group._id}`);
        return;
      } catch {
        // Invite may have expired - fall through to the normal groups view.
      }
    }
    navigate('/groups');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">SettleUp</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {pendingInvite
              ? "Create an account to join your friend's group."
              : 'Create an account to start a group.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-sand bg-white p-6 shadow-sm" noValidate>
          <div className="space-y-4">
            <TextField
              id="name"
              name="name"
              label="Name"
              autoComplete="name"
              required
              value={form.name}
              onChange={handleChange}
              maxLength={80}
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
            />
            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={handleChange}
            />
          </div>

          {(localError || error) && (
            <p className="mt-4 rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">
              {localError || error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="mt-6 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-clay-dark hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
