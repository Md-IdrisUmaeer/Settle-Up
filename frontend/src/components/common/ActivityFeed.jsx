import { useEffect, useState } from 'react';
import * as expensesApi from '../../api/expenses';
import * as settlementsApi from '../../api/settlements';
import Card from './Card';
import EmptyState from './EmptyState';
import { SkeletonRow } from './Skeleton';

/**
 * Fetches expenses + settlements for a group and interleaves them into a
 * single chronological feed. Re-fetches whenever `refreshKey` changes, so
 * the parent can force a reload after an expense/settlement action or a
 * live 'activity:new' event from another member.
 */
export default function ActivityFeed({ groupId, currentUserId, refreshKey }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([expensesApi.listExpenses(groupId), settlementsApi.listSettlements(groupId)])
      .then(([expenses, settlements]) => {
        const expenseItems = expenses.map((e) => ({
          type: 'expense',
          date: e.date,
          data: e,
        }));
        const settlementItems = settlements.map((s) => ({
          type: 'settlement',
          date: s.date,
          data: s,
        }));

        const merged = [...expenseItems, ...settlementItems].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setItems(merged);
      })
      .catch(() => setError('Could not load activity.'));
  }, [groupId, refreshKey]);

  const displayName = (user) => (user._id === currentUserId ? 'You' : user.name);

  if (error) {
    return <p className="rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{error}</p>;
  }

  if (items === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title="No activity yet"
        description="Expenses and settlements will show up here as soon as someone adds one."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={`${item.type}-${item.data._id}`} className="flex items-center justify-between py-3">
          {item.type === 'expense' ? (
            <>
              <div>
                <p className="text-sm text-ink">
                  <span className="font-medium">{displayName(item.data.paidBy)}</span> paid for{' '}
                  <span className="font-medium">{item.data.description}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {item.data.category} · {new Date(item.data.date).toLocaleDateString()}
                </p>
              </div>
              <p className="font-medium text-ink">₹{item.data.amount.toFixed(2)}</p>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-ink">
                  <span className="font-medium">{displayName(item.data.from)}</span> paid{' '}
                  <span className="font-medium">{displayName(item.data.to)}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Settlement · {item.data.status} ·{' '}
                  {new Date(item.data.date).toLocaleDateString()}
                </p>
              </div>
              <p className="font-medium text-credit">₹{item.data.amount.toFixed(2)}</p>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
