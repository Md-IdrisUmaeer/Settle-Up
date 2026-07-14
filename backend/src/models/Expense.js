const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      // this member's share of the expense, in currency units (not cents)
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    category: {
      type: String,
      default: 'General',
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    splitType: {
      type: String,
      enum: ['equal', 'percentage', 'exact', 'shares'],
      required: true,
    },
    splits: {
      type: [splitSchema],
      required: true,
      validate: {
        validator: function (splits) {
          return splits.length > 0;
        },
        message: 'An expense must have at least one split.',
      },
    },
  },
  { timestamps: true }
);

// Sanity check: split amounts should sum to the total expense amount.
// Kept loose (1 cent tolerance) to absorb floating point rounding.
expenseSchema.pre('validate', function (next) {
  if (this.splits && this.splits.length > 0) {
    const sum = this.splits.reduce((acc, s) => acc + s.amount, 0);
    if (Math.abs(sum - this.amount) > 0.01) {
      return next(
        new Error(
          `Split amounts (${sum}) do not sum to the expense amount (${this.amount}).`
        )
      );
    }
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
