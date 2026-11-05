# Recurring Transactions

## Overview

The Recurring Transactions feature automatically generates transaction instances for recurring expenses and income, such as monthly subscriptions, rent, salaries, and other periodic transactions.

## How It Works

### Automatic Processing

When you visit the Transactions page, the system automatically:

1. Scans all your recurring transactions
2. Identifies missing instances (transactions that should have been created based on the recurrence rules)
3. Generates new transaction instances up to today's date
4. Displays a summary of the processing results

### Manual Processing

You can also manually trigger recurring transaction processing at any time by clicking the **"Process Recurring Transactions"** button on the Transactions page.

## Supported Frequencies

The system supports the following recurrence frequencies:

| Frequency | Description | Example |
|-----------|-------------|---------|
| **Daily** | Repeats every N days | Every day, every 3 days |
| **Weekly** | Repeats every N weeks | Every week, every 2 weeks |
| **Biweekly** | Repeats every 2 weeks | Every other week |
| **Monthly** | Repeats every N months | Every month, every 3 months |
| **Quarterly** | Repeats every 3 months | Every quarter |
| **Yearly** | Repeats every N years | Every year |
| **Custom** | Custom interval in days | Every 45 days |

## Transaction Fields

When creating a recurring transaction, you can specify:

- **Frequency**: How often the transaction repeats
- **Interval**: The multiplier for the frequency (e.g., every 2 months)
- **Day of Month**: For monthly transactions, specify which day (1-31)
- **End Date**: Optional date when the recurrence should stop

## How Instances Are Generated

### Monthly Transactions

For monthly transactions with a specific day:

```
Example: Rent payment on the 1st of each month
- Original: 2024-01-01
- Generated: 2024-02-01, 2024-03-01, 2024-04-01, etc.
```

For months with fewer days than specified:

```
Example: Payment on the 31st
- January: 31st ✓
- February: 28th (or 29th in leap years) - adjusted
- March: 31st ✓
- April: 30th - adjusted
```

### Weekly Transactions

```
Example: Weekly grocery shopping every Sunday
- Original: 2024-01-07 (Sunday)
- Generated: 2024-01-14, 2024-01-21, 2024-01-28, etc.
```

### End Date Handling

If an end date is specified, the system will stop generating instances after that date:

```
Example: 12-month subscription ending June 2024
- Start: 2024-01-01
- End Date: 2024-06-01
- Instances: Jan, Feb, Mar, Apr, May, Jun (then stops)
```

## Processing Logic

### Grouping

Recurring transactions are grouped by:
- Title
- Amount
- Category
- Account

This ensures that the system correctly identifies which transactions belong to the same recurring series.

### Duplicate Prevention

Before generating a new instance, the system checks if a transaction already exists with:
- Same user ID
- Same title
- Same amount
- Same category
- Same date

If a match is found, the instance is skipped to prevent duplicates.

### Safety Limits

To prevent infinite loops or system issues:
- Maximum 100 iterations per recurring series
- Processing stops if the limit is reached
- A warning is logged if the limit is hit

## Generated Transaction Properties

New instances inherit the following properties from the original:

| Property | Inherited | Notes |
|----------|-----------|-------|
| Account | ✓ | Same account as original |
| Type | ✓ | Income, expense, or transfer |
| Amount | ✓ | Same amount |
| Category | ✓ | Same category |
| Subcategory | ✓ | Same subcategory |
| Title | ✓ | Same title |
| Notes | ✓ | Same notes |
| Time | ✓ | Same time of day |
| Date | ✗ | Calculated based on recurrence rule |
| Is Paid | ✗ | Always set to `false` for new instances |
| Recurrence Rules | ✓ | Same frequency, interval, end date |
| Tags | ✓ | Same tags |
| Subscription Flag | ✓ | Maintains subscription status |
| Debt Payment | ✓ | Maintains debt payment status |

## Processing Results

After processing, you'll see a summary showing:

- **Recurring series processed**: Number of unique recurring transaction series
- **New instances generated**: Number of new transaction instances created
- **Errors**: Number of errors encountered (if any)

### Example Result

```
✓ Processing Complete

Recurring series processed: 5
New instances generated: 12
Errors: 0
```

This means:
- 5 different recurring transactions were checked
- 12 missing transaction instances were created
- No errors occurred

## Common Use Cases

### 1. Monthly Rent

```
Title: Rent Payment
Amount: R8,500
Frequency: Monthly
Day of Month: 1
End Date: None (ongoing)
```

### 2. Quarterly Subscription

```
Title: Software License
Amount: R299
Frequency: Quarterly
Interval: 1
End Date: None
```

### 3. Weekly Allowance

```
Title: Weekly Allowance
Amount: R500
Frequency: Weekly
Interval: 1
End Date: None
```

### 4. Limited-Time Subscription

```
Title: Gym Membership
Amount: R450
Frequency: Monthly
Day of Month: 15
End Date: 2024-12-15 (12-month contract)
```

## Troubleshooting

### No Instances Generated

If processing returns 0 generated instances, it could mean:

1. **All transactions are up to date**: No missing instances need to be created
2. **No recurring transactions**: You don't have any transactions marked as recurring
3. **End date passed**: The recurrence has ended according to the end date

### Duplicates Created

If you see duplicate transactions:

1. Check if transactions have different titles or amounts
2. Ensure you're not manually creating instances that match recurring ones
3. Contact support if duplicates persist

### Missing Instances

If expected instances are not generated:

1. Verify the transaction is marked as `is_recurring = true`
2. Check that the recurrence frequency is set correctly
3. Ensure the end date hasn't passed
4. Try manually clicking "Process Recurring Transactions"

## Database Schema

Recurring transactions use the following database fields:

```sql
is_recurring: boolean
recurrence_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
recurrence_interval: integer (default: 1)
recurrence_end_date: date (optional)
recurrence_day_of_month: integer 1-31 (optional, for monthly)
```

## Best Practices

1. **Set appropriate end dates**: For fixed-term subscriptions, always set an end date
2. **Use consistent titles**: Keep titles the same for recurring series to avoid fragmentation
3. **Regular processing**: Visit the Transactions page regularly to ensure instances are generated
4. **Review generated transactions**: Check that auto-generated instances are correct
5. **Mark as paid**: Remember to mark instances as paid when the payment clears

## Advanced Usage

### Editing Recurring Transactions

When you edit a recurring transaction, you have two options:

1. **Edit this instance only**: Changes only affect this specific transaction
2. **Edit all future instances**: Updates the recurrence rules (not yet implemented)

### Deleting Recurring Transactions

Deleting a recurring transaction:
- Deletes only that specific instance
- Does not affect other instances in the series
- Does not stop future instances from being generated

To stop a recurring series:
1. Find the original/latest instance
2. Edit it and set an end date to today or a past date

## Performance

The recurring transaction processor is optimized for performance:

- **Batch processing**: All transactions are processed in a single operation
- **Smart grouping**: Transactions are grouped to minimize database queries
- **Duplicate checks**: Efficient existence checks before insertion
- **Safety limits**: Prevents runaway processing with iteration limits

## Future Enhancements

Planned improvements for recurring transactions:

- [ ] UI for creating recurring transactions from the transaction dialog
- [ ] Edit all future instances feature
- [ ] Stop recurrence button
- [ ] Recurring transaction calendar view
- [ ] Notification when new instances are generated
- [ ] Scheduled automatic processing (daily background job)
- [ ] Recurring transaction templates
- [ ] Variable amount support (e.g., utility bills)

## API Reference

### Functions

#### `processRecurringTransactions(userId: string)`

Main function to process all recurring transactions for a user.

**Parameters:**
- `userId`: The user ID to process transactions for

**Returns:**
```typescript
{
  processed: number;  // Number of recurring series checked
  generated: number;  // Number of new instances created
  errors: number;     // Number of errors encountered
}
```

**Example:**
```typescript
const result = await processRecurringTransactions(user.id);
console.log(`Generated ${result.generated} new transactions`);
```

#### `calculateNextOccurrence(lastDate, frequency, interval?, dayOfMonth?)`

Calculates the next occurrence date for a recurring transaction.

**Parameters:**
- `lastDate`: Date - The last transaction date
- `frequency`: string - The recurrence frequency
- `interval`: number - The interval multiplier (optional, default: 1)
- `dayOfMonth`: number - Specific day for monthly transactions (optional)

**Returns:** Date - The next occurrence date

**Example:**
```typescript
const nextDate = calculateNextOccurrence(
  new Date('2024-01-15'),
  'monthly',
  1,
  15
);
// Returns: 2024-02-15
```

#### `shouldGenerateNextInstance(transaction, latestInstanceDate, currentDate?)`

Determines if a new instance should be generated.

**Parameters:**
- `transaction`: RecurringTransaction - The recurring transaction
- `latestInstanceDate`: Date - The date of the latest instance
- `currentDate`: Date - The current date (optional, defaults to now)

**Returns:** boolean - True if a new instance should be generated

#### `generateNextRecurringInstance(transaction, nextDate, userId)`

Generates a single new instance of a recurring transaction.

**Parameters:**
- `transaction`: RecurringTransaction - The template transaction
- `nextDate`: Date - The date for the new instance
- `userId`: string - The user ID

**Returns:** Transaction | null - The created transaction or null if failed

---

**Last Updated**: 2026-06-01
**Version**: 1.0.0
**Author**: Development Team
