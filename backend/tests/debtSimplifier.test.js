const { simplifyDebts, computeNetBalances } = require('../src/services/debtSimplifier');

describe('simplifyDebts', () => {
  test('two-person case: one owes the other directly', () => {
    const balances = [
      { userId: 'alice', amount: 50 },
      { userId: 'bob', amount: -50 },
    ];

    const result = simplifyDebts(balances);

    expect(result).toEqual([{ from: 'bob', to: 'alice', amount: 50 }]);
  });

  test('three-person case collapses to minimum transactions', () => {
    // Alice paid for everything (150), split evenly 3 ways (50 each).
    // Bob and Carol each owe Alice 50 -> but algorithm should still
    // produce the minimal 2 transactions, not more.
    const balances = [
      { userId: 'alice', amount: 100 },
      { userId: 'bob', amount: -50 },
      { userId: 'carol', amount: -50 },
    ];

    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { from: 'bob', to: 'alice', amount: 50 },
        { from: 'carol', to: 'alice', amount: 50 },
      ])
    );
  });

  test('classic example: chain of debts simplifies to fewer transactions', () => {
    // A owes B 10, B owes C 10, C owes A 5
    // Net: A = -10 + 5 = -5, B = 10 - 10 = 0, C = 10 - 5 = 5
    // Expected: single transaction A -> C for 5, B drops out entirely.
    const balances = [
      { userId: 'A', amount: -5 },
      { userId: 'B', amount: 0 },
      { userId: 'C', amount: 5 },
    ];

    const result = simplifyDebts(balances);

    expect(result).toEqual([{ from: 'A', to: 'C', amount: 5 }]);
  });

  test('four-person uneven split produces minimal transaction count', () => {
    const balances = [
      { userId: 'alice', amount: 30 },
      { userId: 'bob', amount: 20 },
      { userId: 'carol', amount: -10 },
      { userId: 'dave', amount: -40 },
    ];

    const result = simplifyDebts(balances);

    // Verify correctness invariants rather than one exact ordering,
    // since greedy matching order can vary with equal-amount ties.
    const totalPaid = result.reduce((acc, t) => acc + t.amount, 0);
    expect(totalPaid).toBeCloseTo(50); // sum of all positive balances

    // Every original debtor/creditor should be fully settled.
    const net = {};
    for (const b of balances) net[b.userId] = b.amount;
    for (const t of result) {
      net[t.from] += t.amount;
      net[t.to] -= t.amount;
    }
    Object.values(net).forEach((v) => expect(v).toBeCloseTo(0));

    // Minimum transactions for 4 people is at most n-1 = 3.
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test('already-settled balances produce zero transactions', () => {
    const balances = [
      { userId: 'alice', amount: 0 },
      { userId: 'bob', amount: 0 },
    ];

    expect(simplifyDebts(balances)).toEqual([]);
  });

  test('ignores negligible floating point dust', () => {
    const balances = [
      { userId: 'alice', amount: 0.001 },
      { userId: 'bob', amount: -0.001 },
    ];

    expect(simplifyDebts(balances)).toEqual([]);
  });

  test('throws if balances do not sum to zero', () => {
    const balances = [
      { userId: 'alice', amount: 50 },
      { userId: 'bob', amount: -30 }, // should be -50
    ];

    expect(() => simplifyDebts(balances)).toThrow(/sum to zero/i);
  });

  test('throws on non-array input', () => {
    expect(() => simplifyDebts(null)).toThrow(TypeError);
    expect(() => simplifyDebts('nope')).toThrow(TypeError);
  });
});

describe('computeNetBalances', () => {
  test('single expense paid by one person, split equally among three', () => {
    const expenses = [
      {
        paidBy: 'alice',
        splits: [
          { user: 'alice', amount: 33.34 },
          { user: 'bob', amount: 33.33 },
          { user: 'carol', amount: 33.33 },
        ],
      },
    ];

    const result = computeNetBalances(expenses);

    const byUser = Object.fromEntries(result.map((b) => [b.userId, b.amount]));
    expect(byUser.alice).toBeCloseTo(66.66); // paid 100, owes 33.34 -> net +66.66
    expect(byUser.bob).toBeCloseTo(-33.33);
    expect(byUser.carol).toBeCloseTo(-33.33);
  });

  test('multiple expenses across a group net out correctly', () => {
    const expenses = [
      {
        paidBy: 'alice',
        splits: [
          { user: 'alice', amount: 25 },
          { user: 'bob', amount: 25 },
        ],
      },
      {
        paidBy: 'bob',
        splits: [
          { user: 'alice', amount: 15 },
          { user: 'bob', amount: 15 },
        ],
      },
    ];

    const result = computeNetBalances(expenses);
    const byUser = Object.fromEntries(result.map((b) => [b.userId, b.amount]));

    // Alice: paid 50, owes (25 + 15) = 40 -> net +10
    // Bob: paid 30, owes (25 + 15) = 40 -> net -10
    expect(byUser.alice).toBeCloseTo(10);
    expect(byUser.bob).toBeCloseTo(-10);
  });

  test('a user who pays for themselves only nets to zero and is omitted', () => {
    const expenses = [
      {
        paidBy: 'alice',
        splits: [{ user: 'alice', amount: 20 }],
      },
    ];

    const result = computeNetBalances(expenses);
    expect(result).toEqual([]);
  });

  test('output of computeNetBalances feeds directly into simplifyDebts', () => {
    const expenses = [
      {
        paidBy: 'alice',
        splits: [
          { user: 'alice', amount: 20 },
          { user: 'bob', amount: 20 },
          { user: 'carol', amount: 20 },
        ],
      },
    ];

    const balances = computeNetBalances(expenses);
    const transactions = simplifyDebts(balances);

    expect(transactions).toHaveLength(2);
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    expect(total).toBeCloseTo(40);
  });
});
