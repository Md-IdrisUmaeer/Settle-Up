const { computeSplits } = require('../src/controllers/expense.controller');

describe('computeSplits', () => {
  describe('equal', () => {
    test('splits evenly when amount divides cleanly', () => {
      const splits = computeSplits(90, 'equal', ['alice', 'bob', 'carol'], null);

      expect(splits).toEqual([
        { user: 'alice', amount: 30 },
        { user: 'bob', amount: 30 },
        { user: 'carol', amount: 30 },
      ]);
    });

    test('gives rounding remainder to the first participant', () => {
      // 100 / 3 = 33.333... -> base 33.33 each, 0.01 leftover goes to alice
      const splits = computeSplits(100, 'equal', ['alice', 'bob', 'carol'], null);

      expect(splits).toEqual([
        { user: 'alice', amount: 33.34 },
        { user: 'bob', amount: 33.33 },
        { user: 'carol', amount: 33.33 },
      ]);

      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBeCloseTo(100);
    });

    test('single participant gets the full amount', () => {
      const splits = computeSplits(50, 'equal', ['alice'], null);
      expect(splits).toEqual([{ user: 'alice', amount: 50 }]);
    });

    test('throws with no participants', () => {
      expect(() => computeSplits(50, 'equal', [], null)).toThrow(/at least one participant/i);
    });
  });

  describe('percentage', () => {
    test('splits according to given percentages', () => {
      const splits = computeSplits(200, 'percentage', null, {
        alice: 50,
        bob: 30,
        carol: 20,
      });

      expect(splits).toEqual(
        expect.arrayContaining([
          { user: 'alice', amount: 100 },
          { user: 'bob', amount: 60 },
          { user: 'carol', amount: 40 },
        ])
      );
    });

    test('throws if percentages do not sum to 100', () => {
      expect(() =>
        computeSplits(200, 'percentage', null, { alice: 50, bob: 40 })
      ).toThrow(/sum to 100/i);
    });

    test('tolerates tiny floating point drift in percentages', () => {
      // 33.33 + 33.33 + 33.34 = 100.00 exactly, but test near-100 tolerance too
      const splits = computeSplits(90, 'percentage', null, {
        alice: 33.34,
        bob: 33.33,
        carol: 33.33,
      });
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBeCloseTo(90);
    });
  });

  describe('exact', () => {
    test('uses the exact amounts given', () => {
      const splits = computeSplits(100, 'exact', null, {
        alice: 60,
        bob: 25,
        carol: 15,
      });

      expect(splits).toEqual(
        expect.arrayContaining([
          { user: 'alice', amount: 60 },
          { user: 'bob', amount: 25 },
          { user: 'carol', amount: 15 },
        ])
      );
    });

    test('throws if exact amounts do not sum to the total', () => {
      expect(() =>
        computeSplits(100, 'exact', null, { alice: 60, bob: 30 })
      ).toThrow(/must sum to the total/i);
    });
  });

  describe('shares', () => {
    test('splits proportionally to share counts', () => {
      // alice: 2 shares, bob: 1 share, carol: 1 share -> total 4 shares, 30/share
      const splits = computeSplits(120, 'shares', null, {
        alice: 2,
        bob: 1,
        carol: 1,
      });

      expect(splits).toEqual(
        expect.arrayContaining([
          { user: 'alice', amount: 60 },
          { user: 'bob', amount: 30 },
          { user: 'carol', amount: 30 },
        ])
      );
    });

    test('handles uneven division with rounding remainder', () => {
      // 100 across 3 shares = 33.333... per share
      const splits = computeSplits(100, 'shares', null, { alice: 1, bob: 1, carol: 1 });
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBeCloseTo(100);
    });

    test('throws if total shares is zero', () => {
      expect(() =>
        computeSplits(100, 'shares', null, { alice: 0, bob: 0 })
      ).toThrow(/greater than zero/i);
    });
  });

  describe('unknown splitType', () => {
    test('throws a descriptive error', () => {
      // splitInput must be non-empty so it clears the participant guard and
      // actually reaches the switch statement's default branch.
      expect(() => computeSplits(100, 'yolo', null, { alice: 100 })).toThrow(
        /unknown splittype/i
      );
    });
  });

  describe('cross-type invariant: splits always sum to the original amount', () => {
    test.each([
      ['equal', ['a', 'b', 'c', 'd', 'e', 'f', 'g'], null, 77.77],
      ['percentage', null, { a: 12.5, b: 37.5, c: 50 }, 250],
      ['exact', null, { a: 10.01, b: 19.99 }, 30],
      ['shares', null, { a: 3, b: 5, c: 2 }, 199.99],
    ])('%s split sums to the total amount', (splitType, participantIds, splitInput, amount) => {
      const ids = participantIds || Object.keys(splitInput);
      const splits = computeSplits(amount, splitType, ids, splitInput);
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      expect(sum).toBeCloseTo(amount, 2);
    });
  });
});
