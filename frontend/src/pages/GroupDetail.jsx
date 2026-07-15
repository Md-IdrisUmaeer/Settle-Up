import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

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

  // Member/ownership management (owner-only actions + leave-group for anyone)
  const [manageMessage, setManageMessage] = useState(null); // { type, text }
  const [removingId, setRemovingId] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

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

    // Someone else deleting the group, removing us, or the owner changing
    // should all be reflected immediately for anyone else viewing this page,
    // not just whoever performed the action.
    function handleGroupDeleted() {
      navigate('/groups', { replace: true });
    }
    function handleMemberRemoved({ userId }) {
      if (userId === user._id) {
        navigate('/groups', { replace: true });
        return;
      }
      loadAll();
    }
    function handleMemberLeft({ userId }) {
      if (userId === user._id) return; // we already navigated away ourselves
      loadAll();
    }
    function handleOwnerChanged() {
      loadAll();
    }

    socket.on('balances:update', handleUpdate);
    socket.on('group:deleted', handleGroupDeleted);
    socket.on('group:memberRemoved', handleMemberRemoved);
    socket.on('group:memberLeft', handleMemberLeft);
    socket.on('group:ownerChanged', handleOwnerChanged);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setLive(socket.connected);

    return () => {
      socket.off('balances:update', handleUpdate);
      socket.off('group:deleted', handleGroupDeleted);
      socket.off('group:memberRemoved', handleMemberRemoved);
      socket.off('group:memberLeft', handleMemberLeft);
      socket.off('group:ownerChanged', handleOwnerChanged);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      leaveGroupRoom(groupId);
    };
  }, [groupId, user._id, navigate, loadAll]);

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

  const isOwner = group?.createdBy && (group.createdBy._id || group.createdBy) === user._id;

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.name} from this group?`)) return;

    setRemovingId(member._id);
    setManageMessage(null);
    try {
      const updated = await groupsApi.removeMember(groupId, member._id);
      setGroup(updated);
      setManageMessage({ type: 'success', text: `${member.name} was removed.` });
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not remove that member.',
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleLeaveGroup() {
    if (!window.confirm('Leave this group?')) return;

    setLeaving(true);
    setManageMessage(null);
    try {
      await groupsApi.leaveGroup(groupId);
      navigate('/groups', { replace: true });
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not leave this group.',
      });
      setLeaving(false);
    }
  }

  async function handleTransferOwnership(e) {
    e.preventDefault();
    if (!transferTarget) return;
    const target = group.members.find((m) => m._id === transferTarget);
    if (!window.confirm(`Make ${target?.name || 'this member'} the new owner?`)) return;

    setTransferring(true);
    setManageMessage(null);
    try {
      const updated = await groupsApi.transferOwnership(groupId, transferTarget);
      setGroup(updated);
      setTransferTarget('');
      setManageMessage({ type: 'success', text: 'Ownership transferred.' });
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not transfer ownership.',
      });
    } finally {
      setTransferring(false);
    }
  }

  async function handleDeleteGroup() {
    if (
      !window.confirm(
        'Permanently delete this group and all its expense/settlement history? This cannot be undone.'
      )
    )
      return;

    setDeletingGroup(true);
    setManageMessage(null);
    try {
      await groupsApi.deleteGroup(groupId);
      navigate('/groups', { replace: true });
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not delete this group.',
      });
      setDeletingGroup(false);
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
                    <span className="text-ink">
                      {m._id === user._id ? 'You' : m.name}
                      {(group.createdBy._id || group.createdBy) === m._id && (
                        <span className="ml-1.5 text-xs text-ink-muted">(owner)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-ink-muted">{m.email}</span>
                      {isOwner && m._id !== user._id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m)}
                          disabled={removingId === m._id}
                          className="text-xs font-medium text-debt hover:underline disabled:opacity-50"
                        >
                          {removingId === m._id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </div>
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

          {/* Manage group: transfer ownership / delete (owner), leave (anyone) */}
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Manage group</h2>
            <Card className="mt-3">
              {manageMessage && (
                <p
                  className={`mb-4 text-sm ${
                    manageMessage.type === 'error' ? 'text-debt' : 'text-credit'
                  }`}
                >
                  {manageMessage.text}
                </p>
              )}

              {isOwner && group.members.length > 1 && (
                <form onSubmit={handleTransferOwnership} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Transfer ownership to
                    </label>
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink focus:border-clay-dark focus:outline-none"
                    >
                      <option value="">Select a member…</option>
                      {group.members
                        .filter((m) => m._id !== user._id)
                        .map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={!transferTarget}
                    loading={transferring}
                  >
                    Transfer
                  </Button>
                </form>
              )}

              <div
                className={`flex items-center justify-between ${
                  isOwner && group.members.length > 1 ? 'mt-4 border-t border-sand pt-4' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {isOwner ? 'Delete this group' : 'Leave this group'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {isOwner
                      ? 'Everyone must be settled up first. This cannot be undone.'
                      : 'You must be settled up in this group first.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  {!isOwner && (
                    <Button variant="secondary" onClick={handleLeaveGroup} loading={leaving}>
                      Leave group
                    </Button>
                  )}
                  {isOwner && (
                    <Button
                      className="!bg-debt hover:!bg-debt/90"
                      onClick={handleDeleteGroup}
                      loading={deletingGroup}
                    >
                      Delete group
                    </Button>
                  )}
                </div>
              </div>
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
