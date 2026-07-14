import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as groupsApi from '../api/groups';
import * as balancesApi from '../api/balances';
import { useAuth } from '../context/AuthContext';
import { getSocket, joinGroupRoom, leaveGroupRoom } from '../socket';
import AppLayout from '../components/common/AppLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';
import SettleUpSection from '../components/common/SettleUpSection';
import ActivityFeed from '../components/common/ActivityFeed';
import { SkeletonCard } from '../components/common/Skeleton';
import { isValidEmail } from '../utils/validation';

export default function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);
  const [feedKey, setFeedKey] = useState(0);
  const [live, setLive] = useState(false); // whether the socket is actively connected

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [g, b, t] = await Promise.all([
        groupsApi.getGroup(groupId),
        balancesApi.getBalances(groupId),
        balancesApi.getSimplifiedDebts(groupId),
      ]);
      setGroup(g);
      setBalances(b);
      setTransactions(t);
      setFeedKey((k) => k + 1);
    } catch {
      setError('Could not load this group.');
    }
  }, [groupId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Real-time balances: join this group's room and listen for server-pushed
  // updates so everyone viewing the group sees changes instantly, without
  // needing to refresh whenever a member adds an expense or settles up.
  useEffect(() => {
    const socket = getSocket();
    joinGroupRoom(groupId);

    function handleUpdate({ balances: b, transactions: t }) {
      setBalances(b);
      setTransactions(t);
      setFeedKey((k) => k + 1); // also refresh the activity feed
    }
    function handleConnect() {
      setLive(true);
      joinGroupRoom(groupId); // re-join on reconnect
    }
    function handleDisconnect() {
      setLive(false);
    }

    socket.on('balances:update', handleUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setLive(socket.connected);

    return () => {
      socket.off('balances:update', handleUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      leaveGroupRoom(groupId);
    };
  }, [groupId]);

  async function handleInvite(e) {
    e.preventDefault();

    const trimmed = inviteEmail.trim();
    if (!isValidEmail(trimmed)) {
      setInviteMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }

    setInviting(true);
    setInviteMessage(null);
    try {
      const updated = await groupsApi.inviteByEmail(groupId, trimmed);
      setGroup(updated);
      setInviteEmail('');
      setInviteMessage({ type: 'success', text: 'Added to the group.' });
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not send invite.',
      });
    } finally {
      setInviting(false);
    }
  }

  const inviteLink = group?.inviteCode
    ? `${window.location.origin}/invite/${group.inviteCode}`
    : null;

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setInviteMessage({ type: 'error', text: 'Could not copy the link — copy it manually.' });
    }
  }

  if (error) {
    return (
      <AppLayout wide>
        <p className="rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{error}</p>
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout wide>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  const myBalance = balances?.find((b) => b.userId === user._id)?.amount || 0;

  return (
    <AppLayout wide>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/groups" className="text-sm text-ink-muted hover:underline">
            ← Your groups
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{group.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-1.5 text-xs text-ink-muted sm:flex ${
              live ? '' : 'opacity-60'
            }`}
            title={live ? 'Live updates connected' : 'Reconnecting…'}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-credit' : 'bg-ink-muted'}`}
            />
            {live ? 'Live' : 'Reconnecting…'}
          </span>
          <Link to={`/groups/${groupId}/expenses/new`}>
            <Button>Add expense</Button>
          </Link>
        </div>
      </div>

      {/* Two-column layout: main content on the left, Activity pinned to the
          right so the page reads wider and shorter rather than one long,
          narrow, centered scroll. Collapses to a single column on mobile. */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Your net balance in this group */}
          <Card>
            <p className="text-sm text-ink-muted">Your balance in this group</p>
            {myBalance === 0 ? (
              <p className="mt-1 font-display text-2xl font-semibold text-ink">Settled up</p>
            ) : myBalance > 0 ? (
              <p className="mt-1 font-display text-2xl font-semibold text-credit">
                You are owed ₹{myBalance.toFixed(2)}
              </p>
            ) : (
              <p className="mt-1 font-display text-2xl font-semibold text-debt">
                You owe ₹{Math.abs(myBalance).toFixed(2)}
              </p>
            )}
          </Card>

          {/* Minimize Payments + Settle Up */}
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Minimize payments</h2>
            <p className="mt-1 text-sm text-ink-muted">
              The smallest set of payments that settles everyone up.
            </p>

            <SettleUpSection
              groupId={groupId}
              members={group.members}
              currentUserId={user._id}
              transactions={transactions}
              onChange={loadAll}
            />
          </section>

          {/* Members + invite */}
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Members</h2>
            <Card className="mt-3">
              <ul className="divide-y divide-sand">
                {group.members.map((m) => (
                  <li key={m._id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{m._id === user._id ? 'You' : m.name}</span>
                    <span className="text-ink-muted">{m.email}</span>
                  </li>
                ))}
              </ul>

              {/* Invite via link */}
              {inviteLink && (
                <div className="mt-4 border-t border-sand pt-4">
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Invite via link
                  </label>
                  <p className="mb-2 text-xs text-ink-muted">
                    Anyone with this link can join after creating an account — no need for them
                    to already have one.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      readOnly
                      value={inviteLink}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 truncate rounded-md border border-sage bg-olive/40 px-3.5 py-2.5 text-sm text-ink-muted focus:outline-none"
                    />
                    <Button variant="secondary" onClick={copyInviteLink} type="button">
                      {linkCopied ? 'Copied!' : 'Copy link'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Invite by email */}
              <form
                onSubmit={handleInvite}
                className="mt-4 flex items-end gap-3 border-t border-sand pt-4"
              >
                <TextField
                  id="inviteEmail"
                  label="Invite by email"
                  type="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" loading={inviting}>
                  Invite
                </Button>
              </form>
              {inviteMessage && (
                <p
                  className={`mt-2 text-sm ${
                    inviteMessage.type === 'error' ? 'text-debt' : 'text-credit'
                  }`}
                >
                  {inviteMessage.text}
                </p>
              )}
            </Card>
          </section>
        </div>

        {/* Activity feed - sticky sidebar on the right on large screens */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-8">
            <h2 className="font-display text-lg font-semibold text-ink">Activity</h2>
            <div className="mt-3">
              <ActivityFeed groupId={groupId} currentUserId={user._id} refreshKey={feedKey} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
