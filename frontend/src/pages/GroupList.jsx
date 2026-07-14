import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as groupsApi from '../api/groups';
import AppLayout from '../components/common/AppLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';
import EmptyState from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/Skeleton';
import { isNonEmptyString } from '../utils/validation';

export default function GroupList() {
  const [groups, setGroups] = useState(null); // null = still loading
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [nameError, setNameError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    groupsApi
      .listGroups()
      .then(setGroups)
      .catch(() => setError('Could not load your groups. Try refreshing.'));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setNameError(null);

    const trimmed = newGroupName.trim();
    if (!isNonEmptyString(trimmed, { max: 80 })) {
      setNameError('Give the group a name (up to 80 characters).');
      return;
    }

    setCreating(true);
    try {
      const group = await groupsApi.createGroup({ name: trimmed });
      setGroups((prev) => [group, ...(prev || [])]);
      setNewGroupName('');
      setShowCreateForm(false);
    } catch (err) {
      setNameError(err.response?.data?.message || 'Could not create the group. Try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout wide>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Your groups</h1>
        <Button onClick={() => setShowCreateForm((s) => !s)}>
          {showCreateForm ? 'Cancel' : 'New group'}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mt-4">
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <TextField
              id="groupName"
              label="Group name"
              placeholder="Trip to Goa"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1"
              error={nameError}
              autoFocus
              maxLength={80}
            />
            <Button type="submit" loading={creating}>
              Create
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{error}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups === null &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {groups?.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon="groups"
              title="No groups yet"
              description="Create one above to start splitting expenses with people, or ask a friend for their invite link."
            />
          </div>
        )}

        {groups?.map((group) => (
          <Link key={group._id} to={`/groups/${group._id}`}>
            <Card className="h-full transition-colors hover:border-clay">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{group.name}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {group.members.length} member{group.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-sage-dark">→</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
