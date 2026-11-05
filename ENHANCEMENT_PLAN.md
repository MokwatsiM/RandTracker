# RandTracker enhancement plan: ideas from Actual Budget

This plan compares RandTracker with [Actual Budget](https://github.com/actualbudget/actual) (release v26.11.0, November 2026) and lists what to adopt. Each item extends something RandTracker already has rather than replacing it. Where Actual's approach doesn't suit a South African, server-hosted app, the plan says so and leaves it out.

## Summary

RandTracker already goes further than Actual on debt (snowball and avalanche, amortisation, loan accounts), on investments (TFSA limits, performance snapshots) and on South African defaults. Actual is stronger at the daily routine: getting transactions in, categorising them automatically, matching expected bills, and planning each month's money.

The biggest wins, in order:

1. **Fix how data loads and balances are calculated.** Every new transaction downloads every transaction twice, and lists will quietly lose rows once a user has more than 1,000. This has to come first, because the other features depend on it.
2. **Rules.** Automatic categorisation and payee clean-up, learned from the user's own edits. This replaces the hard-coded merchant list in the statement parser.
3. **Better imports.** CSV, OFX and QIF, which all major South African banks can export, plus duplicate detection. The FNB PDF parser stays as one of the sources.
4. **Schedules.** A proper home for debit orders and subscriptions, replacing the current approach of copying recurring transactions.
5. **A monthly budget view based on payday.** Actual's "money to budget" idea plus budget automations, built on the existing `budgets` table and `payday_date`.
6. **Ledger features.** Split transactions, cleared and reconciled status, tags, undo and bulk edit.
7. **Reports and a configurable dashboard**, calculated on the server.

## What RandTracker has today

| Area | Current state | Notes |
|---|---|---|
| Accounts | 7 types, including credit, loan and store cards. Liabilities are stored as negative balances. | Balances are recalculated in the browser after every change. |
| Transactions | Income, expense and transfer, with linked transfer rows, debt payment split (principal and interest), soft delete. | `tags` and `attachment_url` columns exist but nothing uses them. `Transaction.splits` exists in TypeScript but not in the database. |
| Recurring | `is_recurring` plus frequency fields on the transaction itself. `RecurringTransactionProcessor` copies the latest row forward when a page loads. | The series is identified by title, amount, category and account, so editing any of them starts a new series. The query doesn't skip deleted rows, so deleted recurring transactions can come back. Two open devices can create duplicates. |
| Import | PDF upload, FNB credit card statements only, with a hard-coded merchant-to-category map. | Saves rows one at a time with no duplicate check. The parsed closing balance isn't used. |
| Budgets | One amount per category per period (weekly, monthly, yearly or custom), alert threshold, history and comparison views. | `rollover_unused` is saved but not used in any calculation. |
| Goals | Saving and debt payoff goals, monthly contribution, link to an account or debt. | Not connected to budgets. |
| Debts | Snowball and avalanche planner, amortisation, term in months. | Stronger than Actual, which has no debt tools. |
| Investments | Holdings, transactions, TFSA contribution tracking, performance snapshots. | Stronger than Actual. |
| Analytics | 11 database views and 3 functions (spending, monthly summary, net worth, budget performance and more). | Views apply each user's row-level security since migration 009. |
| Export | CSV and JSON backup from Settings. | |
| Offline | The landing page says "Works without internet", but there is no service worker. | The `sync_queue` table is never used. |

## Feature comparison

| Actual feature | RandTracker today | Plan |
|---|---|---|
| Rules: conditions, actions, pre/default/post stages, learning from edits, payee renames | Hard-coded merchant map used during PDF import | **Adopt** (Phase 1) |
| Import from CSV, OFX, QFX, QIF and CAMT, with duplicate detection | FNB PDF only, no duplicate check | **Adopt CSV, OFX and QIF** (Phase 1). CAMT is rare in South Africa. |
| Bank sync (GoCardless, SimpleFIN, Pluggy, Akahu, Enable Banking) | None | **Leave out.** None of these providers cover South African banks. |
| Schedules: exact, approximate or range amounts, auto-add or approve, upcoming and missed, Find schedules | Copies recurring transactions forward | **Adopt** (Phase 2), replacing the copying approach |
| Envelope budget: money to budget, carry-over, overspending | Budgets per category and period | **Adopt as a monthly view** (Phase 3), keeping existing budgets |
| Budget automations (fixed, by date, average, percent, schedule, remainder, limits) | Fixed amount per budget | **Adopt the main types** (Phase 3) |
| Split transactions | In TypeScript only | **Adopt** (Phase 4) |
| Reconciliation and cleared status | None | **Adopt** (Phase 4) |
| Tags, including filters and reports by tag | Column only | **Adopt** (Phase 4) |
| Undo and redo | Soft delete only | **Adopt undo** for delete and edit (Phase 4) |
| Filters, bulk edit, column manager | Basic filters | **Adopt** (Phase 4) |
| Reports: net worth, cash flow, custom, spending, calendar, Sankey, budget analysis, dashboard cards | Analytics page backed by views | **Adopt the main ones** (Phase 5) |
| Monte Carlo (experimental) | Investments exist | Later, optional |
| Local-first sync (CRDT) and end-to-end encryption | Server-based with row-level security, self-hosted | **Leave out.** This would mean rewriting the data layer. |
| Multi-currency | South African rand only | Leave out for now |
| Payee entities and payee merging | Free-text title | **Partly**: keep the bank's original text and clean up names with rules |

## Phase 0: Data loading and efficiency (done, November 2026)

This came first, because rules, imports and schedules would all have made the old slow paths worse.

### 0.1 Balances calculated in the database (done: migration 010)

Saving a transaction used to download every transaction twice to add up balances in the browser. Now database triggers recalculate the affected accounts and debts with `SUM`, once per statement, using the same rules as before:
- **Timing:** only transactions dated today or earlier count, in South African time, and deleted ones are skipped.
- **Transfers:** a transfer is credited to the account it went into.
- **Debts:** a debt's balance is derived from its payments only once a payment is linked, so a balance you typed in by hand is kept until then.
- **Account edits:** writing an account's balance directly, as the account dialog does, is corrected automatically.
- **Future-dated transactions:** `refresh_my_balances()` runs when accounts load, so these start counting once their date arrives.

The functions users can call run with their own rights, and anonymous visitors can't call them. The trigger itself runs with the owner's rights (migration 012), because Supabase Auth deletes a user's transactions as its own database role. It only counts transactions belonging to the account's or debt's owner, so one user can't change another's balances. The browser code that did this before has been removed.

### 0.2 No more rows silently lost past 1,000 (done)

`fetchTransactions` and `fetchTransactionsByDateRange` now read page by page, so every row arrives. The transaction store keeps the list for 2 minutes. Changes made in the browser update it directly, and recurring processing forces a reload. Before this, each page downloaded the whole history again whenever it opened.

**Still to do (Phase 4):** the pages work on the full list in the browser. Switching them to filtered, paged queries is part of the filter work in 4.4.

### 0.3 Bulk import (done)

The statement dialog saves every row in a single insert, which PostgREST runs as one database transaction. The whole statement is saved or none of it is, and balances are recalculated once. No extra function was needed.

### 0.4 Scheduled work on the server (moved to Phase 2)

`pg_cron` is already loaded in the database, and nothing in Phase 0 needs it. Phase 2 enables it to post due schedules each night.

### 0.5 Tidy up (done)

- **Migration 011:** drops the unused `sync_queue` table.
- **TypeScript:** removed the unused `SyncQueueItem` type and the `splits` field. Phase 4 adds splits back properly.
- **Landing page:** the untrue "Offline First" card now says "Private by Design".
- **Related fix:** the dashboard and accounts page total was subtracting asset balances. It's now the plain sum, because liabilities are stored as negative numbers.

## Phase 1: Rules and better imports (done, November 2026)

**What shipped:**
- **Database:** migrations 013 (`rules`, `transactions.imported_payee`, `user_profiles.rule_learning`) and 014 (`transactions.imported_id` with a unique index per account, `accounts.import_settings`).
- **Rules engine:** in `src/lib/rules/`, used by the import dialog, the transaction dialog (it suggests a category when you type a title) and the new Rules page.
- **Learning:** changing a category teaches that payee's learned rule. Retitling an imported transaction offers a rename rule. Learning can be turned off in Settings.
- **Starter rules:** about 20 rules covering common South African merchants, added from the Rules page.
- **Importers:** CSV, OFX, QFX and QIF parsers sit alongside the FNB PDF parser. The CSV column mapping is saved per account.
- **Import review:** shows each row's category and where it came from, already-imported rows (left out), and possible duplicates (unticked). It also compares the statement's closing balance with the account.
- **Tests:** 49 Vitest unit tests, which the Docker build runs before every deploy.

**Differences from the plan below:**
- **Merchant map:** the FNB PDF parser's map still exists, but only as a fallback hint when no rule sets a category. The starter rules replace it.
- **Rule order:** rules run in specificity order, which can't be dragged into a different order.
- **Bulk edit:** "apply to matching transactions" changes everything a rule matches at once. Selecting individual rows to bulk-edit is still part of Phase 4.


### 1.1 Rules engine (L)

Most of the value of Actual's import comes from its rules.

**Data (migration 013)**
- `rules`: `id`, `user_id`, `stage` (`pre`, `default` or `post`), `conditions jsonb`, `actions jsonb`, `sort_order`, `is_auto` (learned rather than written by the user), `created_at`, with row-level security.
- `transactions.imported_payee text`: the bank's original description, kept unchanged so rename rules can always match it.

**Conditions:** imported payee, title, account, category, amount (with inflow and outflow), date and notes. Operators: is, is not, contains, does not contain, one of, matches (regex), greater than and less than for amounts.

**Actions:** set category, subcategory, title, notes, tags, transaction type or `exclude_from_budget`; mark as a debt payment for a given debt; append to notes. Phase 2 adds "link to schedule".

**Engine:** a pure TypeScript module, `src/lib/rules/`, used both by the import route and by the transaction dialog. Rules run by stage, and within a stage from least to most specific, so an exact match beats a substring match.

**Learning:**
- **Category:** when a user changes a transaction's category, create or update an automatic rule matching that payee with its most common category.
- **Payee rename:** when a user renames a payee, offer to create a `pre` rename rule.
- **Turning it off:** a setting to stop learning, either completely or for one payee.

**Starter rules:** turn the hard-coded `categorizeMerchant` map in `statement-parser.ts` into default rules. Examples include Checkers, Woolworths, Pick n Pay, Engen, Shell, Uber, Takealot, Vodacom, MTN, Eskom or the municipality, and Discovery. Users can then edit them, which they can't do with the map today.

**UI:** a Rules page with a list, an editor, and "apply to matching transactions", which doubles as bulk edit.

### 1.2 More import formats and duplicate detection (L)

**Parsers** in `src/lib/import/`:
- `csv.ts`: with column mapping (date, description, amount or debit/credit, balance), date format and decimal format, saved per account. FNB, Capitec, Standard Bank, Absa, Nedbank, TymeBank and Discovery Bank all export CSV.
- `ofx.ts`: OFX and QFX, using the bank's `FITID` as the imported ID.
- `qif.ts`: QIF.
- The existing FNB PDF parser stays, as one more source with the same output format.

**Duplicate detection (migration 014):**
- **Exact:** add `transactions.imported_id text`, with a unique index on `(account_id, imported_id)` where it's set. OFX supplies the ID; for CSV and PDF, use a hash of date, amount and description.
- **Fuzzy:** flag rows on the same account with the same amount within 3 days, marked "possible duplicate", for the user to keep or skip.

**Preview screen:** an upgrade of `StatementUploadDialog`. Each row shows whether it's new, a duplicate or matches a schedule, plus the category the rules picked. The user can change it before importing, which also trains the rules.

**Reconcile from the statement:** the PDF and OFX parsers already read the closing balance. After an import, compare it with the account balance and offer to reconcile (see 4.2).

## Phase 2: Schedules for debit orders and subscriptions

### 2.1 Schedules table (L)

**Migration 015:** `schedules`, with these fields:
- **Basics:** `id`, `user_id`, `name`, `account_id`, `payee`, `category_id`, `type`.
- **Amount:** `amount_type` (`exact`, `approx` or `range`), plus `amount` or `amount_min` and `amount_max`.
- **Timing:** recurrence (frequency, interval, day of month or "last day"), `next_date`, `end_date`, and `weekend` (`none`, `before` or `after`).
- **Behaviour:** `auto_add`, `is_subscription`, and an optional `debt_id`.

Transactions get a `schedule_id` column.

**Moving existing data:** turn each current recurring series, grouped by the key the processor uses today, into one schedule, and link its past transactions. The `is_recurring` columns stay readable for history until a later clean-up migration.

**Posting:** a nightly `pg_cron` job, `post_due_schedules()`, creates transactions for due schedules that have `auto_add` on. A unique index on `(schedule_id, date)` stops duplicates. This replaces `RecurringTransactionProcessor` and the duplicates, resurrections and broken series described above.

**Approvals:** schedules without `auto_add` appear as "upcoming" and "missed" items on the dashboard and in the account ledger, with approve and skip buttons.

**Public holidays:** South African banks move debit orders that fall on weekends and public holidays, and Actual's schedules ignore holidays. Add a small `za_public_holidays` table, filled in once a year, so dates move to the next working day.

### 2.2 Matching and detection (M)

- **Match imported transactions:** an imported row on the same account within 2 days of a scheduled date, and within the schedule's amount range, links to the schedule instead of creating a duplicate.
- **Find schedules:** detect repeating payees in history with a regular interval and similar amounts, and suggest them as schedules.
- **Links to existing features:** debt minimum payments become schedules with a `debt_id`. Subscriptions become schedules with `is_subscription`, shown on a "Subscriptions" summary with monthly and yearly cost.

## Phase 3: Monthly budget view based on payday

### 3.1 A budget month built on existing budgets (L)

Existing budgets keep working. A new **Budget month** view adds Actual's envelope ideas:

- **Payday cycles:** a budget month runs from `user_profiles.payday_date` to the day before the next payday, for example the 25th to the 24th. Many South Africans are paid on the 25th, and Actual only supports calendar months.
- **Money to budget:** income received in the cycle, plus last cycle's leftover, minus what's been assigned.
- **Per category:** assigned, spent and available. Available carries into the next cycle when `rollover_unused` is on, which finally uses that column. Overspending is shown in red and taken from the next cycle's money to budget.
- **Data (migration 016):** `budget_allocations(user_id, category_id, cycle_start date, amount)`, with row-level security and a unique index on `(user_id, category_id, cycle_start)`. Calculated by a `budget_month(cycle_start)` function, not in the browser.

### 3.2 Budget automations (M)

Add a `template jsonb` column to `budgets` and a **Fill budget** button that writes allocations. Supported templates:

| Template | What it does | Built from |
|---|---|---|
| Fixed | The budget's amount each cycle | `budgets.amount`, which is the default and matches today's behaviour |
| Average | Average spending over the last N cycles | The existing spending views |
| Schedule | The total of the category's schedules due this cycle | Phase 2 |
| By date | Save toward a goal by its target date | `goals.target_amount` and `target_date`, which links goals to budgets |
| Percent of income | A share of the cycle's income | Income categories |
| Up to | Cap a category's available amount | |

Automations run in priority order and never assign more than the money to budget. Each category shows a ring that fills as its target is met, in green, amber or red.

## Phase 4: Ledger features

### 4.1 Split transactions (M)

Add `parent_id uuid` to `transactions`, where child rows hold each category's amount and the parent holds the total. The editor checks that the parts add up. Reports and budgets count the child rows and skip the parent, which the views can handle with `WHERE NOT is_split_parent`.

### 4.2 Cleared status and reconciliation (M)

- **Columns:** add `cleared boolean` and `reconciled boolean` to transactions, and `last_reconciled_at` and `last_reconciled_balance` to accounts.
- **Reconcile flow:** the user enters the statement balance, or it comes from the import (1.2). The app shows the difference against cleared transactions. Once it reaches zero, the user locks those rows as reconciled, and editing a reconciled row asks for confirmation.
- **Account page:** add a running balance column to the ledger.

### 4.3 Tags (S)

The `tags text[]` column already exists. Add tag chips in the dialogs, read `#tags` typed in notes, filter by "has any" or "has all" tags, and report by tag. A GIN index on `tags` keeps tag filters fast.

### 4.4 Undo, filters and bulk edit (M)

- **Undo:** a toast with Undo for delete and edit. Delete already uses `is_deleted`, so undo just sets it back. For edits, keep the previous values in the store for 10 seconds.
- **Filters:** a filter builder with amount range, notes contains, uncategorised, cleared, tag and schedule, run as a query with `pg_trgm` for fast text search. Users can save filters.
- **Bulk edit:** select rows, then set category, tags or cleared. Changing a category this way offers to create a rule.

## Phase 5: Reports and dashboard

### 5.1 Reports calculated on the server (M)

Add database functions, all with `security_invoker` like migration 009, so each user only sees their own data:

- **Cash flow:** income and expenses per cycle or month, with a running balance.
- **Net worth over time:** assets minus liabilities per month, using `account_balance_history`.
- **Spending compared:** each category against the last cycle and against its 3-month average.
- **Budget analysis:** assigned, spent and available over time, once Phase 3 exists.
- **Calendar:** daily spending plus upcoming schedules.
- **Sankey:** income to categories to savings and debt.

Each report also gets a CSV download, using the existing `src/lib/export.ts`.

### 5.2 Configurable dashboard (M)

Add a `dashboard_layout jsonb` column to `user_profiles`. Users can add, remove, reorder and resize cards, covering the reports above plus debt-free date, TFSA room and upcoming debit orders.

## What to leave out, and why

- **Local-first sync with CRDTs, and end-to-end encryption:** RandTracker is built around a server database with row-level security. Adopting either would mean rewriting the data layer, and self-hosting already keeps the data under your control.
- **Bank sync:** none of Actual's providers (GoCardless, SimpleFIN, Pluggy, Akahu, Enable Banking) support South African banks. Better imports cover most of the need. A South African aggregator could be looked at later.
- **Multi-currency:** the app is South African rand only by design.
- **YNAB importers and formulas in rules:** little value for this app.

## Order and size

| Phase | Depends on | Size | Main migrations |
|---|---|---|---|
| 0: Efficiency (done) | Nothing | M | 010 (balance functions and triggers), 011 (drop `sync_queue`), 012 (trigger rights) |
| 1: Rules and import | 0 | L | 013 (rules, `imported_payee`), 014 (`imported_id`) |
| 2: Schedules | 0, and best after 1 | L | 015 (schedules, holidays, `pg_cron` job) |
| 3: Budget month | 2, for the schedule template | L | 016 (allocations, budget templates) |
| 4: Ledger features | 0 | M | Splits, cleared and reconciled, tag index, `pg_trgm` |
| 5: Reports and dashboard | 3 and 4, for the full set | M | Report functions, dashboard layout |

Phase 4 can run alongside Phases 2 and 3, because it touches different files.

## Ground rules for every phase

- **Security:** every new table gets row-level security limited to `auth.uid() = user_id`. Every new view or report function uses `security_invoker` or filters by `auth.uid()`. Extend the two-user isolation test from the deployment to cover each new table, view and function.
- **Deployment:** migrations go in `supabase/migrations/` and run automatically when pushed to `dev`. Each migration must work on an empty database as well as on live data.
- **Server limits:** the VPS has 1 vCPU and 3.8 GB of RAM, shared with the LGE recorder. Do heavy work in SQL rather than in extra containers. `pg_cron` and `pg_trgm` already ship with the database image.
- **Tests:** the project has no test runner yet. Add Vitest with the rules engine, so the rules, the parsers (CSV, OFX, QIF and FNB PDF), duplicate detection, schedule date maths and budget cycle maths are unit-tested from the start.
- **No rewrites:** existing tables, stores and pages stay. New features extend `budgets`, `transactions`, the statement dialog and the analytics views, and anything they replace (`RecurringTransactionProcessor`, the merchant map, browser-side balance maths) is only removed once its replacement has shipped.

## Sources

- [Actual Budget on GitHub](https://github.com/actualbudget/actual) and its [releases](https://github.com/actualbudget/actual/releases), up to v26.11.0
- [Actual features](https://actualbudget.org/#features)
- Actual docs on [rules](https://actualbudget.org/docs/budgeting/rules/), [schedules](https://actualbudget.org/docs/schedules) and [budget automations](https://actualbudget.org/docs/experimental/goal-templates)
- [Actual release notes](https://actualbudget.org/docs/releases)
