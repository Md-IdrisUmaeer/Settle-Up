const mongoose = require('mongoose');
const dbHandler = require('./helpers/dbHandler');

const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Expense = require('../src/models/Expense');
const Settlement = require('../src/models/Settlement');
const { getGroupBalances, getSimplifiedDebts } = require('../src/services/balance.service');

beforeAll(async () => {
  await dbHandler.connect();
});

afterEach(async () => {
  await dbHandler.clearDatabase();
});

afterAll(async () => {
  await dbHandler.closeDatabase();
});

/** Helper: create three users + a group for them, return everything needed. */
async function seedGroupOfThree() {
  const [alice, bob, carol] = await User.create([
    { name: 'Alice', email: 'alice@test.com', passwordHash: 'x' },
    { name: 'Bob', email: 'bob@test.com', passwordHash: 'x' },
    { name: 'Carol', email: 'carol@test.com', passwordHash: 'x' },
  ]);

  const group = await Group.create({
    name: 'Trip to Goa',
    members: [alice._id, bob._id, carol._id],
    createdBy: alice._id,
  });

  return { alice, bob, carol, group };
}

describe('balance.service (integration, in-memory Mongo)', () => {
  test('getGroupBalances reflects a single equally-split expense', async () => {
    const { alice, bob, carol, group } = await seedGroupOfThree();

    await Expense.create({
      group: group._id,
      description: 'Hotel',
      amount: 90,
      paidBy: alice._id,
      splitType: 'equal',
      splits: [
        { user: alice._id, amount: 30 },
        { user: bob._id, amount: 30 },
        { user: carol._id, amount: 30 },
      ],
    });

    const balances = await getGroupBalances(group._id);
    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));

    expect(byUser[alice._id.toString()]).toBeCloseTo(60);
    expect(byUser[bob._id.toString()]).toBeCloseTo(-30);
    expect(byUser[carol._id.toString()]).toBeCloseTo(-30);
  });

  test('completed settlements reduce balances, pending settlements do not', async () => {
    const { alice, bob, carol, group } = await seedGroupOfThree();

    await Expense.create({
      group: group._id,
      description: 'Groceries',
      amount: 60,
      paidBy: alice._id,
      splitType: 'equal',
      splits: [
        { user: alice._id, amount: 20 },
        { user: bob._id, amount: 20 },
        { user: carol._id, amount: 20 },
      ],
    });

    // Bob actually pays Alice back in full (completed).
    await Settlement.create({
      group: group._id,
      from: bob._id,
      to: alice._id,
      amount: 20,
      status: 'completed',
    });

    // Carol says she'll pay but hasn't yet (pending) - should NOT count.
    await Settlement.create({
      group: group._id,
      from: carol._id,
      to: alice._id,
      amount: 20,
      status: 'pending',
    });

    const balances = await getGroupBalances(group._id);
    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));

    // Bob is fully settled -> should not appear at all.
    expect(byUser[bob._id.toString()]).toBeUndefined();
    // Carol still owes 20 (pending settlement doesn't count).
    expect(byUser[carol._id.toString()]).toBeCloseTo(-20);
    // Alice is still owed by Carol only.
    expect(byUser[alice._id.toString()]).toBeCloseTo(20);
  });

  test('getSimplifiedDebts returns minimal transactions end-to-end', async () => {
    const { alice, bob, carol, group } = await seedGroupOfThree();

    await Expense.create({
      group: group._id,
      description: 'Road trip gas',
      amount: 100,
      paidBy: alice._id,
      splitType: 'equal',
      splits: [
        { user: alice._id, amount: 34 },
        { user: bob._id, amount: 33 },
        { user: carol._id, amount: 33 },
      ],
    });

    const transactions = await getSimplifiedDebts(group._id);

    expect(transactions).toHaveLength(2);
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    expect(total).toBeCloseTo(66);

    // Both transactions should flow toward Alice.
    transactions.forEach((t) => expect(t.to).toBe(alice._id.toString()));
  });

  test('a group with no expenses has no balances and no debts', async () => {
    const { group } = await seedGroupOfThree();

    const balances = await getGroupBalances(group._id);
    const transactions = await getSimplifiedDebts(group._id);

    expect(balances).toEqual([]);
    expect(transactions).toEqual([]);
  });

  test('fully settled group nets to zero balances', async () => {
    const { alice, bob, group } = await seedGroupOfThree();

    await Expense.create({
      group: group._id,
      description: 'Movie tickets',
      amount: 40,
      paidBy: alice._id,
      splitType: 'equal',
      splits: [
        { user: alice._id, amount: 20 },
        { user: bob._id, amount: 20 },
      ],
    });

    await Settlement.create({
      group: group._id,
      from: bob._id,
      to: alice._id,
      amount: 20,
      status: 'completed',
    });

    const balances = await getGroupBalances(group._id);
    expect(balances).toEqual([]);
  });
});
