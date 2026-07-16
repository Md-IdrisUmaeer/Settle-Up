import { useEffect, useState } from 'react';
import * as settlementsApi from '../../api/settlements';
import Card from './Card';
import Button from './Button';
import TextField from './TextField';
import EmptyState from './EmptyState';
import { SkeletonRow } from './Skeleton';
import { parseAmount } from '../../utils/validation';

/**
 * Renders:
 *  1. The "Minimize Payments" suggestions with a one-click "Mark as paid"
 *     that records a completed settlement for exactly that suggestion.
 *  2. A manual "Record a payment" form for settlements outside the
 *     suggested set (e.g. someone pays more/less than suggested).
 *  3. The settlement history, with pending -> completed toggling and delete.
 *
 * @param {string} groupId
 * @param {Array} members - group.members (populated user docs)
 * @param {string} currentUserId
 * @param {Array} transactions - simplified debt suggestions [{from,to,amount}]
 * @param {Function} onChange - called after any settlement action, so the
 *   parent can re-fetch balances/transactions (they'll have shifted).
 */
export default function SettleUpSection({ groupId, members, currentUserId, transactions, onChange }) {
  const [settlements, setSettlements] = useState(null);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null); // tracks which button is mid-request

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ from: '', to: '', amount: '' });
  const [manualErrors, setManualErrors] = useState({});
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const memberName = (id) => {
    const m = members.find((mem) => mem._id === id);
    return m ? (m._id === currentUserId ? 'You' : m.name) : 'Unknown';
  };

  async function loadSettlements() {
    try {
      const data = await settlementsApi.listSettlements(groupId);
      setSettlements(data);
    } catch {
      setError('Could not load settlement history.');
    }
  }

  useEffect(() => {
    loadSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function markSuggestionPaid(t, key) {
    setBusyKey(key);
    setError(null);
    try {
      await settlementsApi.createSettlement(groupId, {
        from: t.from,
        to: t.to,
        amount: t.amount,
        status: 'completed',
      });
      await loadSettlements();
      onChange?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record payment.');
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleStatus(settlement) {
    setBusyKey(settlement._id);
    setError(null);
    try {
      const nextStatus = settlement.status === 'completed' ? 'pending' : 'completed';
      await settlementsApi.updateSettlementStatus(groupId, settlement._id, nextStatus);
      await loadSettlements();
      onChange?.();
    } catch {
      setError('Could not update settlement.');
    } finally {
      setBusyKey(null);
    }
  }

  async function removeSettlement(settlement) {
    setBusyKey(settlement._id);
    setError(null);
    try {
      await settlementsApi.deleteSettlement(groupId, settlement._id);
      await loadSettlements();
      onChange?.();
    } catch {
      setError('Could not delete settlement.');
    } finally {
      setBusyKey(null);
    }
  }

  function validateManualForm() {
    const errors = {};
    if (!manualForm.from) errors.from = 'Select who paid.';
    if (!manualForm.to) errors.to = 'Select who received it.';
    if (manualForm.from && manualForm.to && manualForm.from === manualForm.to) {
      errors.to = 'Payer and receiver must be different people.';
    }
    const amount = parseAmount(manualForm.amount);
    if (amount === null) {
      errors.amount = 'Enter an amount greater than 0.';
    }
    return { errors, amount };
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    setError(null);

    const { errors, amount } = validateManualForm();
    setManualErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setManualSubmitting(true);
    try {
      const isInvolved = manualForm.from === currentUserId || manualForm.to === currentUserId;
      await settlementsApi.createSettlement(groupId, {
        from: manualForm.from,
        to: manualForm.to,
        amount,
        status: isInvolved ? 'completed' : 'pending',
      });
      setManualForm({ from: '', to: '', amount: '' });
      setManualErrors({});
      setShowManualForm(false);
      await loadSettlements();
      onChange?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Settle up</h2>
        <Button variant="secondary" onClick={() => setShowManualForm((s) => !s)}>
          {showManualForm ? 'Cancel' : 'Record a payment'}
        </Button>
      </div>

      {showManualForm && (
        <Card className="mt-3">
          <form onSubmit={handleManualSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Paid by</label>
                <select
                  value={manualForm.from}
                  onChange={(e) => setManualForm((f) => ({ ...f, from: e.target.value }))}
                  className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink focus:border-clay-dark focus:outline-none"
                >
                  <option value="">Select…</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m._id === currentUserId ? 'You' : m.name}
                    </option>
                  ))}
                </select>
                {manualErrors.from && (
                  <p className="mt-1.5 text-sm text-debt">{manualErrors.from}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Paid to</label>
                <select
                  value={manualForm.to}
                  onChange={(e) => setManualForm((f) => ({ ...f, to: e.target.value }))}
                  className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink focus:border-clay-dark focus:outline-none"
                >
                  <option value="">Select…</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m._id === currentUserId ? 'You' : m.name}
                    </option>
                  ))}
                </select>
                {manualErrors.to && <p className="mt-1.5 text-sm text-debt">{manualErrors.to}</p>}
              </div>
            </div>
            <TextField
              id="settleAmount"
              label="Amount (₹)"
              type="number"
              step="0.01"
              min="0.01"
              value={manualForm.amount}
              onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))}
              error={manualErrors.amount}
            />
            <Button type="submit" loading={manualSubmitting} className="w-full">
              Record payment
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{error}</p>
      )}

      {/* Suggested payments with one-click settle */}
      <div className="mt-3 space-y-2">
        {transactions?.length === 0 && (
          <EmptyState
            icon="settled"
            title="Everyone's settled up"
            description="No suggested payments right now — nice work."
          />
        )}
        {transactions?.map((t, i) => {
          const key = `suggestion-${i}`;
          const isInvolved = t.from === currentUserId || t.to === currentUserId;
          return (
            <Card key={key} className="flex items-center justify-between py-3">
              <p className="text-sm text-ink">
                <span className="font-medium">{memberName(t.from)}</span> pays{' '}
                <span className="font-medium">{memberName(t.to)}</span>
              </p>
              <div className="flex items-center gap-3">
                <p className="font-medium text-clay-dark">₹{t.amount.toFixed(2)}</p>
                {isInvolved && (
                  <Button
                    variant="secondary"
                    loading={busyKey === key}
                    onClick={() => markSuggestionPaid(t, key)}
                  >
                    Mark as paid
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Settlement history */}
      {settlements === null && (
        <div className="mt-6 space-y-2">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {settlements?.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-ink-muted">History</p>
          <div className="space-y-2">
            {settlements.map((s) => {
              const isInvolved = s.from._id === currentUserId || s.to._id === currentUserId;
              return (
                <Card key={s._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-ink">
                      <span className="font-medium">
                        {s.from._id === currentUserId ? 'You' : s.from.name}
                      </span>{' '}
                      paid{' '}
                      <span className="font-medium">
                        {s.to._id === currentUserId ? 'You' : s.to.name}
                      </span>{' '}
                      ₹{s.amount.toFixed(2)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'completed'
                        ? 'bg-credit-bg text-credit'
                        : 'bg-debt-bg text-debt'
                        }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  {isInvolved && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        loading={busyKey === s._id}
                        onClick={() => toggleStatus(s)}
                      >
                        {s.status === 'completed' ? 'Mark pending' : 'Mark completed'}
                      </Button>
                      <Button
                        variant="secondary"
                        loading={busyKey === s._id}
                        onClick={() => removeSettlement(s)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
