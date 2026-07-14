import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as groupsApi from '../api/groups';
import * as expensesApi from '../api/expenses';
import AppLayout from '../components/common/AppLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import TextField from '../components/common/TextField';
import { SkeletonCard } from '../components/common/Skeleton';
import { isNonEmptyString, parseAmount } from '../utils/validation';

const SPLIT_TYPES = [
  { value: 'equal', label: 'Equal' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'exact', label: 'Exact amount' },
  { value: 'shares', label: 'Shares' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddExpense() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState(todayISO());
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');

  // For 'equal': which members are included (checkbox list).
  // For percentage/exact/shares: a value per member (string, parsed on submit).
  const [participantIds, setParticipantIds] = useState([]);
  const [splitValues, setSplitValues] = useState({}); // { [userId]: string }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    groupsApi
      .getGroup(groupId)
      .then((g) => {
        setGroup(g);
        const ids = g.members.map((m) => m._id);
        setParticipantIds(ids);
        setPaidBy(g.members[0]?._id || '');
        setSplitValues(Object.fromEntries(ids.map((id) => [id, ''])));
      })
      .catch(() => setLoadError('Could not load this group.'));
  }, [groupId]);

  function toggleParticipant(id) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function updateSplitValue(id, value) {
    setSplitValues((prev) => ({ ...prev, [id]: value }));
  }

  // Live running total for percentage/exact/shares, so the person can see
  // whether they're under/over before hitting submit.
  const numericAmount = parseFloat(amount) || 0;
  const splitEntries =
    group?.members.map((m) => [m._id, parseFloat(splitValues[m._id]) || 0]) || [];
  const splitSum = splitEntries.reduce((acc, [, v]) => acc + v, 0);

  let helperText = null;
  if (splitType === 'percentage') {
    helperText = `${splitSum.toFixed(1)}% of 100%`;
  } else if (splitType === 'exact') {
    helperText = `₹${splitSum.toFixed(2)} of ₹${numericAmount.toFixed(2)}`;
  } else if (splitType === 'shares') {
    helperText = `${splitSum} total share${splitSum === 1 ? '' : 's'}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = {};
    if (!isNonEmptyString(description, { max: 200 })) {
      errors.description = 'Description is required (up to 200 characters).';
    }
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      errors.amount = 'Enter an amount greater than 0.';
    }
    if (!paidBy) {
      errors.paidBy = 'Choose who paid.';
    }

    if (splitType === 'equal') {
      if (participantIds.length === 0) {
        errors.split = 'Select at least one person to split with.';
      }
    } else {
      // Reject negative or non-finite entries outright, rather than
      // silently dropping them, so a typo can't quietly skew the split.
      const invalidEntry = splitEntries.find(([, v]) => v < 0 || !Number.isFinite(v));
      if (invalidEntry) {
        errors.split = 'Split values must be zero or positive numbers.';
      } else if (splitEntries.every(([, v]) => v <= 0)) {
        errors.split = 'Enter at least one split value.';
      } else if (splitType === 'percentage' && Math.abs(splitSum - 100) > 0.01) {
        errors.split = `Percentages must add up to 100 (currently ${splitSum.toFixed(1)}).`;
      } else if (
        splitType === 'exact' &&
        parsedAmount !== null &&
        Math.abs(splitSum - parsedAmount) > 0.01
      ) {
        errors.split = `Exact amounts must add up to ₹${parsedAmount.toFixed(2)} (currently ₹${splitSum.toFixed(2)}).`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Fix the highlighted fields before submitting.');
      return;
    }

    const payload = {
      description: description.trim(),
      amount: parsedAmount,
      category,
      paidBy,
      date,
      splitType,
    };

    if (splitType === 'equal') {
      payload.participantIds = participantIds;
    } else {
      const splitInput = Object.fromEntries(splitEntries.filter(([, v]) => v > 0));
      payload.splitInput = splitInput;
    }

    setSubmitting(true);
    try {
      await expensesApi.createExpense(groupId, payload);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add expense.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <AppLayout>
        <p className="rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{loadError}</p>
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to={`/groups/${groupId}`} className="text-sm text-ink-muted hover:underline">
        ← {group.name}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Add expense</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
        <Card className="space-y-4">
          <TextField
            id="description"
            label="Description"
            placeholder="Dinner at the beach shack"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={fieldErrors.description}
            maxLength={200}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="amount"
              label="Amount (₹)"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fieldErrors.amount}
              required
            />
            <TextField
              id="date"
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayISO()}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink focus:border-clay-dark focus:outline-none"
              >
                {['General', 'Food', 'Travel', 'Stay', 'Activities', 'Shopping'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paidBy" className="mb-1.5 block text-sm font-medium text-ink">
                Paid by
              </label>
              <select
                id="paidBy"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink focus:border-clay-dark focus:outline-none"
              >
                {group.members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {fieldErrors.paidBy && (
                <p className="mt-1.5 text-sm text-debt">{fieldErrors.paidBy}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Split type toggle */}
        <Card>
          <p className="mb-3 text-sm font-medium text-ink">Split</p>
          <div className="flex gap-2">
            {SPLIT_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setSplitType(st.value)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  ${
                    splitType === st.value
                      ? 'bg-clay text-cream'
                      : 'bg-olive text-ink hover:bg-sage/60'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Equal: checkbox list of participants */}
          {splitType === 'equal' && (
            <ul className="mt-4 divide-y divide-sand">
              {group.members.map((m) => (
                <li key={m._id} className="flex items-center justify-between py-2">
                  <label htmlFor={`p-${m._id}`} className="text-sm text-ink">
                    {m.name}
                  </label>
                  <input
                    id={`p-${m._id}`}
                    type="checkbox"
                    checked={participantIds.includes(m._id)}
                    onChange={() => toggleParticipant(m._id)}
                    className="h-4 w-4 accent-clay"
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Percentage / Exact / Shares: per-member value input */}
          {splitType !== 'equal' && (
            <>
              <ul className="mt-4 divide-y divide-sand">
                {group.members.map((m) => (
                  <li key={m._id} className="flex items-center justify-between gap-3 py-2">
                    <label htmlFor={`v-${m._id}`} className="flex-1 text-sm text-ink">
                      {m.name}
                    </label>
                    <input
                      id={`v-${m._id}`}
                      type="number"
                      step={splitType === 'shares' ? '1' : '0.01'}
                      min="0"
                      placeholder="0"
                      value={splitValues[m._id] || ''}
                      onChange={(e) => updateSplitValue(m._id, e.target.value)}
                      className="w-28 rounded-md border border-sage bg-white px-2.5 py-1.5 text-right text-sm text-ink focus:border-clay-dark focus:outline-none"
                    />
                  </li>
                ))}
              </ul>
              {helperText && <p className="mt-3 text-sm text-ink-muted">{helperText}</p>}
            </>
          )}

          {fieldErrors.split && (
            <p className="mt-3 text-sm text-debt">{fieldErrors.split}</p>
          )}
        </Card>

        {error && (
          <p className="rounded-md bg-debt-bg px-3 py-2 text-sm text-debt">{error}</p>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          Add expense
        </Button>
      </form>
    </AppLayout>
  );
}
