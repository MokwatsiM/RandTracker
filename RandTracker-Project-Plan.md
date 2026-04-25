# RandTracker — Comprehensive Project Plan

### A South African Budget & Debt Management App

---

## 1. Product Vision

RandTracker is a personal finance application for South Africans that combines the seamless, offline-first experience of Cashew with dedicated debt management and credit card tracking. Users can record transactions in seconds, build flexible budgets, track loans with interest calculations, and monitor credit card spending — all in ZAR with local financial context.

The app launches as a **Progressive Web App (PWA)** with full mobile responsiveness, with a path to native mobile wrappers later if needed.

---

## 2. Core Feature Set

### 2.1 Accounts & Wallets

- **Multiple account types:** Cheque, Savings, Cash, Credit Card, Loan, Store Card
- **Per-account balances** with running totals
- **Credit card accounts** show: current balance, credit limit, available credit, utilisation percentage, statement date, due date
- **Loan accounts** show: outstanding principal, interest rate, monthly instalment, remaining term, total interest paid vs remaining
- **Account transfers** between wallets (e.g., paying credit card from cheque account)
- **Primary account** designation (default for new transactions, base currency)
- **Account grouping** (e.g., "FNB Accounts", "Credit Cards", "Loans")

### 2.2 Transactions

- **Quick-add transaction** — opens a numpad-first interface, enter amount → select category → done (under 5 seconds for a basic expense)
- **Transaction types:** Income, Expense, Transfer, Debt Payment
- **Fields:** Amount, date/time, category, subcategory, account, notes, payee/merchant, attachments (receipt photo)
- **Recurring transactions** with flexible schedules: daily, weekly, bi-weekly, monthly (specific date or last day), quarterly, yearly, custom interval
- **Upcoming/future transactions** list with auto-mark-as-paid option
- **Subscription tracking** — flag recurring expenses as subscriptions with renewal reminders
- **Split transactions** — divide a single transaction across multiple categories
- **Batch operations** — multi-select for bulk categorise, delete, or move
- **Search & filter** — by date range, category, account, amount range, keyword in notes

### 2.3 Categories & Subcategories

- **Pre-loaded SA-relevant categories:** Groceries, Transport/Petrol, Airtime & Data, Electricity/Prepaid, Medical Aid, Insurance, Rent/Bond, School Fees, Entertainment, Eating Out, Clothing, Personal Care, Home Maintenance, Savings, Investments, Debt Repayment
- **Custom categories** with emoji or icon selection
- **Subcategories** (e.g., Transport → Petrol, Uber, Taxi, Tolls)
- **Category colour coding** for visual distinction in charts
- **Income categories:** Salary, Freelance, Side Hustle, Interest, Dividends, Rental Income, Other

### 2.4 Budgets

- **Flexible time periods:** Weekly, bi-weekly, monthly, custom date range, one-off (e.g., holiday budget)
- **Budget start date alignment** — set to your payday (e.g., 25th of each month) rather than calendar month
- **Per-category spending limits** within a budget
- **Added budgets** — create focused budgets that only include selected categories or accounts
- **Budget history** — view and compare past budget periods
- **Progress indicators** — visual progress bars showing spent vs remaining, with colour shifts (green → amber → red)
- **Rollover option** — carry unspent amounts to the next period
- **Daily allowance calculation** — remaining budget ÷ remaining days

### 2.5 Debt Management (Dedicated Module)

This is the differentiator. A full debt dashboard, not just account balances.

**Loan Tracking:**
- Add loans with: principal amount, interest rate (fixed or variable), loan term, start date, monthly instalment, payment due date
- **Amortisation schedule** — auto-generated table showing principal vs interest breakdown per payment
- **Extra payment modelling** — "what if I pay R500 extra per month?" calculator showing time and interest saved
- **Loan types:** Personal Loan, Home Loan/Bond, Vehicle Finance, Student Loan, Store Credit, Custom
- **Progress visualisation** — percentage paid off, estimated payoff date, total interest projection

**Credit Card Tracking:**
- Statement period tracking with custom billing cycle dates
- Minimum payment vs full payment tracking
- Interest calculation on carried balances (using the card's interest rate)
- Credit utilisation percentage per card and across all cards
- Payment due date reminders
- "Pay this much to clear by [date]" calculator

**Debt Snowball / Avalanche Planner:**
- List all debts and choose a payoff strategy
- **Snowball:** Smallest balance first (motivation wins)
- **Avalanche:** Highest interest rate first (mathematical optimum)
- **Custom:** Manual priority ordering
- Visual timeline showing projected payoff dates for each debt
- Monthly allocation planner — how much goes to each debt after minimums

**Store Card Tracking:**
- Track store cards (Woolworths, Edgars, Mr Price, etc.) with their balances and interest rates
- Flag interest-free periods and alert when they expire

### 2.6 Goals

- **Saving goals:** Target amount, deadline, monthly contribution calculation
- **Debt payoff goals:** Link to a loan/credit card, track progress
- **Goal categories:** Emergency Fund, Holiday, Education, Vehicle Deposit, House Deposit, Custom
- **Visual progress** — progress bar or ring with percentage and estimated completion date

### 2.7 Analytics & Reporting

- **Spending breakdown** — pie charts by category, bar charts by time period
- **Income vs Expense** trend line over months
- **Net worth tracking** — total assets (accounts) minus total liabilities (debts)
- **Category comparison** — month-over-month spending per category
- **Heatmap calendar** — spending intensity by day
- **Top merchants/payees** — where you spend most
- **Debt-to-income ratio** calculation
- **Export to CSV/Excel** for external analysis or tax prep

### 2.8 Notifications & Reminders

- Budget threshold alerts (50%, 75%, 90%, 100%)
- Upcoming bill/subscription reminders
- Loan payment due dates
- Credit card statement and payment due dates
- Goal milestone celebrations
- Recurring transaction reminders

### 2.9 Data Management

- **CSV import** — map columns to fields during import
- **CSV/Excel export**
- **Local backup** — download full database as JSON
- **Cloud sync** via Supabase — real-time sync across devices
- **Offline-first** — full functionality without internet, syncs when reconnected

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | **Next.js 14+ (App Router)** | React-based, SSR/SSG for web performance, excellent PWA support, single codebase for web and mobile-responsive views |
| **UI Library** | **shadcn/ui + Tailwind CSS** | Professional component library, fully customisable, accessible, dark mode support out of the box |
| **Local Storage** | **Dexie.js (IndexedDB wrapper)** | Offline-first local database, reactive queries, excellent performance for thousands of transactions |
| **Remote Storage** | **Supabase (PostgreSQL)** | Auth, real-time database, Row Level Security, free tier generous for personal use |
| **State Management** | **Zustand** | Lightweight, minimal boilerplate, works well with async storage |
| **Charts** | **Recharts** | React-native charting, responsive, good for pie/bar/line charts |
| **Date Handling** | **date-fns** | Lightweight, tree-shakeable, locale support (en-ZA) |
| **Currency** | **dinero.js** | Precise monetary calculations (avoids floating point issues), ZAR support |
| **PWA** | **next-pwa** | Service worker generation, offline caching, installable on mobile |
| **Notifications** | **Web Push API + Supabase Edge Functions** | Push notifications for reminders |

### 3.2 Why This Stack (Not Flutter)

While you have strong Flutter experience, for this project a web-first PWA approach offers advantages. There's no app store approval needed, instant deployments, a single codebase that works on desktop and mobile browsers, and Supabase has first-class JavaScript SDKs. If native mobile becomes essential later, the same Supabase backend works with a Flutter frontend — you could build a Flutter mobile app that shares the database layer.

### 3.3 Project Structure

```
randtracker/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth routes (login, register)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/              # Protected app routes
│   │   │   ├── layout.tsx            # Shell with sidebar/bottom nav
│   │   │   ├── page.tsx              # Home/Dashboard
│   │   │   ├── transactions/
│   │   │   │   ├── page.tsx          # Transaction list
│   │   │   │   └── [id]/page.tsx     # Transaction detail/edit
│   │   │   ├── budgets/
│   │   │   │   ├── page.tsx          # Budget overview
│   │   │   │   └── [id]/page.tsx     # Budget detail
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx          # Accounts list
│   │   │   │   └── [id]/page.tsx     # Account detail
│   │   │   ├── debts/
│   │   │   │   ├── page.tsx          # Debt dashboard
│   │   │   │   ├── loans/[id]/page.tsx
│   │   │   │   ├── cards/[id]/page.tsx
│   │   │   │   └── planner/page.tsx  # Snowball/Avalanche planner
│   │   │   ├── goals/
│   │   │   │   └── page.tsx
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── transactions/
│   │   │   ├── QuickAddSheet.tsx      # Bottom sheet numpad-first entry
│   │   │   ├── TransactionCard.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   └── TransactionFilters.tsx
│   │   ├── budgets/
│   │   │   ├── BudgetCard.tsx
│   │   │   ├── BudgetProgress.tsx
│   │   │   └── CategoryLimitBar.tsx
│   │   ├── debts/
│   │   │   ├── DebtOverviewCard.tsx
│   │   │   ├── AmortisationTable.tsx
│   │   │   ├── CreditCardWidget.tsx
│   │   │   ├── PayoffCalculator.tsx
│   │   │   └── SnowballPlanner.tsx
│   │   ├── charts/
│   │   │   ├── SpendingPieChart.tsx
│   │   │   ├── IncomeExpenseBar.tsx
│   │   │   ├── NetWorthLine.tsx
│   │   │   └── SpendingHeatmap.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── BottomNav.tsx         # Mobile navigation
│   │   │   ├── Header.tsx
│   │   │   └── FAB.tsx               # Floating action button for quick-add
│   │   └── shared/
│   │       ├── AmountDisplay.tsx      # Formatted ZAR display
│   │       ├── DatePicker.tsx
│   │       ├── CategoryPicker.tsx
│   │       └── AccountPicker.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── dexie.ts              # Dexie database schema & init
│   │   │   ├── schema.ts             # TypeScript interfaces
│   │   │   └── seed.ts               # Default categories, sample data
│   │   ├── supabase/
│   │   │   ├── client.ts             # Supabase browser client
│   │   │   ├── server.ts             # Supabase server client
│   │   │   ├── migrations/           # SQL migration files
│   │   │   └── sync.ts               # Offline ↔ cloud sync logic
│   │   ├── calculations/
│   │   │   ├── amortisation.ts       # Loan amortisation schedule
│   │   │   ├── interest.ts           # Interest calculations
│   │   │   ├── snowball.ts           # Debt payoff strategies
│   │   │   └── budget.ts             # Budget period calculations
│   │   ├── currency.ts               # dinero.js ZAR formatting
│   │   └── utils.ts
│   ├── stores/
│   │   ├── transactionStore.ts       # Zustand store
│   │   ├── budgetStore.ts
│   │   ├── accountStore.ts
│   │   ├── debtStore.ts
│   │   └── syncStore.ts
│   └── hooks/
│       ├── useTransactions.ts
│       ├── useBudget.ts
│       ├── useDebts.ts
│       └── useSync.ts
├── supabase/
│   └── migrations/                   # Supabase SQL migrations
│       ├── 001_profiles.sql
│       ├── 002_accounts.sql
│       ├── 003_categories.sql
│       ├── 004_transactions.sql
│       ├── 005_budgets.sql
│       ├── 006_debts.sql
│       ├── 007_goals.sql
│       └── 008_rls_policies.sql
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker
│   └── icons/                        # App icons (192, 512)
├── next.config.js
├── tailwind.config.ts
└── package.json
```

### 3.4 Data Models

#### Accounts
```typescript
interface Account {
  id: string;                          // UUID
  user_id: string;
  name: string;                        // "FNB Cheque", "Woolworths Card"
  type: 'cheque' | 'savings' | 'cash' | 'credit_card' | 'loan' | 'store_card' | 'investment';
  currency: string;                    // "ZAR"
  initial_balance: number;             // In cents (avoid floats)
  current_balance: number;             // Calculated from transactions
  is_primary: boolean;
  icon: string;                        // Emoji or icon name
  color: string;                       // Hex colour
  group_name?: string;                 // Optional grouping
  
  // Credit card specific
  credit_limit?: number;
  statement_day?: number;              // Day of month (1-31)
  payment_due_day?: number;
  interest_rate?: number;              // Annual % (e.g., 21.75)
  minimum_payment_percentage?: number; // e.g., 5
  
  // Loan specific
  loan_principal?: number;
  loan_interest_rate?: number;         // Annual %
  loan_term_months?: number;
  loan_start_date?: string;
  monthly_instalment?: number;
  
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  synced_at?: string;
}
```

#### Transactions
```typescript
interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;                      // In cents, always positive
  category_id: string;
  subcategory_id?: string;
  title: string;                       // Short description / payee
  notes?: string;
  date: string;                        // ISO date
  time?: string;
  
  // Recurring
  is_recurring: boolean;
  recurrence_rule?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    interval?: number;                 // For custom: every N days
    end_date?: string;
    day_of_month?: number;             // For monthly (e.g., 25)
  };
  is_subscription: boolean;
  
  // Transfer specific
  transfer_account_id?: string;        // Destination account
  linked_transaction_id?: string;      // The paired transaction
  
  // Debt specific
  is_debt_payment: boolean;
  debt_id?: string;                    // Links to loan/credit card
  principal_portion?: number;          // How much went to principal
  interest_portion?: number;           // How much went to interest
  
  // Split transaction
  splits?: {
    category_id: string;
    amount: number;
    notes?: string;
  }[];
  
  // Metadata
  attachment_url?: string;
  tags?: string[];
  is_paid: boolean;                    // For upcoming/future transactions
  exclude_from_budget: boolean;
  
  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: boolean;                 // Soft delete for sync
}
```

#### Categories
```typescript
interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;                        // Emoji
  color: string;
  type: 'income' | 'expense';
  is_system: boolean;                  // Pre-loaded categories
  sort_order: number;
  subcategories?: Subcategory[];
  created_at: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  icon?: string;
  sort_order: number;
}
```

#### Budgets
```typescript
interface Budget {
  id: string;
  user_id: string;
  name: string;
  amount: number;                      // Total budget in cents
  period: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  start_date: string;                  // Aligns with payday
  end_date?: string;                   // For custom/one-off budgets
  is_recurring: boolean;
  
  // Filters — which transactions count toward this budget
  account_ids?: string[];              // Specific accounts only
  category_ids?: string[];             // Specific categories only
  include_income: boolean;
  
  // Category limits within this budget
  category_limits?: {
    category_id: string;
    limit: number;
  }[];
  
  allow_rollover: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  synced_at?: string;
}
```

#### Debts (dedicated debt tracking entity)
```typescript
interface Debt {
  id: string;
  user_id: string;
  account_id: string;                  // Links to the account
  name: string;
  type: 'personal_loan' | 'home_loan' | 'vehicle_finance' | 'student_loan' | 'credit_card' | 'store_card' | 'custom';
  
  original_amount: number;             // Original principal in cents
  current_balance: number;             // Outstanding balance
  interest_rate: number;               // Annual percentage
  interest_type: 'fixed' | 'variable';
  
  monthly_payment: number;             // Required monthly payment
  minimum_payment?: number;            // Minimum (for credit cards)
  payment_due_day: number;             // Day of month
  
  start_date: string;
  term_months?: number;                // Loan term
  estimated_payoff_date?: string;      // Calculated
  
  // Tracking
  total_paid: number;                  // Total payments made
  total_interest_paid: number;         // Total interest paid so far
  
  // Snowball/Avalanche
  priority_order?: number;             // Manual priority for payoff planner
  extra_payment?: number;              // Extra monthly amount allocated
  
  lender: string;                      // "FNB", "Woolworths", etc.
  notes?: string;
  is_paid_off: boolean;
  paid_off_date?: string;
  
  created_at: string;
  updated_at: string;
  synced_at?: string;
}
```

#### Goals
```typescript
interface Goal {
  id: string;
  user_id: string;
  name: string;
  type: 'saving' | 'debt_payoff';
  target_amount: number;
  current_amount: number;
  deadline?: string;
  icon: string;
  color: string;
  linked_account_id?: string;
  linked_debt_id?: string;
  monthly_contribution?: number;       // Calculated or manual
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}
```

### 3.5 Supabase Schema (PostgreSQL)

```sql
-- 001_profiles.sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT,
  currency TEXT DEFAULT 'ZAR',
  payday_date INTEGER DEFAULT 25,
  theme TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 002_accounts.sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cheque','savings','cash','credit_card','loan','store_card','investment')),
  currency TEXT DEFAULT 'ZAR',
  initial_balance BIGINT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#6366f1',
  group_name TEXT,
  credit_limit BIGINT,
  statement_day INTEGER,
  payment_due_day INTEGER,
  interest_rate DECIMAL(5,2),
  minimum_payment_percentage DECIMAL(5,2),
  loan_principal BIGINT,
  loan_interest_rate DECIMAL(5,2),
  loan_term_months INTEGER,
  loan_start_date DATE,
  monthly_instalment BIGINT,
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 003_categories.sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6366f1',
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 004_transactions.sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount BIGINT NOT NULL,
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  title TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule JSONB,
  is_subscription BOOLEAN DEFAULT FALSE,
  transfer_account_id UUID REFERENCES accounts(id),
  linked_transaction_id UUID,
  is_debt_payment BOOLEAN DEFAULT FALSE,
  debt_id UUID,
  principal_portion BIGINT,
  interest_portion BIGINT,
  splits JSONB,
  attachment_url TEXT,
  tags TEXT[],
  is_paid BOOLEAN DEFAULT TRUE,
  exclude_from_budget BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);

-- 005_budgets.sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly','biweekly','monthly','custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_recurring BOOLEAN DEFAULT TRUE,
  account_ids UUID[],
  category_ids UUID[],
  include_income BOOLEAN DEFAULT FALSE,
  category_limits JSONB,
  allow_rollover BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 006_debts.sql
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  original_amount BIGINT NOT NULL,
  current_balance BIGINT NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  interest_type TEXT DEFAULT 'fixed' CHECK (interest_type IN ('fixed','variable')),
  monthly_payment BIGINT NOT NULL,
  minimum_payment BIGINT,
  payment_due_day INTEGER NOT NULL,
  start_date DATE NOT NULL,
  term_months INTEGER,
  total_paid BIGINT DEFAULT 0,
  total_interest_paid BIGINT DEFAULT 0,
  priority_order INTEGER,
  extra_payment BIGINT DEFAULT 0,
  lender TEXT,
  notes TEXT,
  is_paid_off BOOLEAN DEFAULT FALSE,
  paid_off_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 007_goals.sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('saving','debt_payoff')),
  target_amount BIGINT NOT NULL,
  current_amount BIGINT DEFAULT 0,
  deadline DATE,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#10b981',
  linked_account_id UUID REFERENCES accounts(id),
  linked_debt_id UUID REFERENCES debts(id),
  monthly_contribution BIGINT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 008_rls_policies.sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users access own profiles" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Users access own accounts" ON accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users access own categories" ON categories FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users access own transactions" ON transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users access own budgets" ON budgets FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users access own debts" ON debts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users access own goals" ON goals FOR ALL USING (user_id = auth.uid());
```

### 3.6 Local Storage (Dexie.js Schema)

```typescript
// lib/db/dexie.ts
import Dexie, { type Table } from 'dexie';

export class RandTrackerDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  subcategories!: Table<Subcategory>;
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  debts!: Table<Debt>;
  goals!: Table<Goal>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('randtracker');
    this.version(1).stores({
      accounts: 'id, user_id, type, is_primary, sort_order',
      categories: 'id, user_id, type, sort_order',
      subcategories: 'id, category_id',
      transactions: 'id, user_id, account_id, category_id, date, type, [user_id+date], [account_id+date]',
      budgets: 'id, user_id, start_date',
      debts: 'id, user_id, type, is_paid_off',
      goals: 'id, user_id, type',
      syncQueue: '++id, table, operation, synced',
    });
  }
}

export const db = new RandTrackerDB();
```

### 3.7 Offline-First Sync Strategy

The sync approach is: **local-first, push-pull with conflict resolution.**

```
┌──────────────────────────────────────────────────────────────┐
│                      User Action                             │
│                          │                                   │
│                    ┌─────▼──────┐                             │
│                    │  Dexie.js  │  ← Write locally first     │
│                    │ (IndexedDB)│                             │
│                    └─────┬──────┘                             │
│                          │                                   │
│                    ┌─────▼──────┐                             │
│                    │ Sync Queue │  ← Track pending changes   │
│                    └─────┬──────┘                             │
│                          │                                   │
│              ┌───────────▼───────────┐                        │
│              │  Online?              │                        │
│              │  Yes → Push to        │                        │
│              │        Supabase       │                        │
│              │  No  → Queue for      │                        │
│              │        later          │                        │
│              └───────────────────────┘                        │
│                                                              │
│  On reconnect: Flush sync queue → Pull remote changes        │
│  Conflict resolution: Last-write-wins based on updated_at    │
└──────────────────────────────────────────────────────────────┘
```

Each mutation writes to Dexie first, then enqueues a sync operation. When online, the sync service processes the queue in order. Supabase Realtime subscriptions pull down changes made on other devices.

---

## 4. Key UI/UX Flows

### 4.1 Quick-Add Transaction (The Core Loop)

This must be fast. Under 5 seconds for a basic expense.

```
User taps FAB (+) button
    │
    ▼
Bottom sheet slides up with NUMPAD
    │  User types amount: "R 245.50"
    ▼
Swipe right or tap "Next"
    │
    ▼
Category grid (recently used first, then all)
    │  User taps "Groceries"
    ▼
DONE — transaction saved with:
  • Today's date (auto)
  • Primary account (auto)
  • Amount: R245.50
  • Category: Groceries
  
  Optional: User can tap "More" to add:
  • Notes, payee, subcategory
  • Different account
  • Different date
  • Receipt photo
  • Tags
  • Recurring settings
```

### 4.2 Credit Card Payment Flow

```
User navigates to Debts → Credit Cards → "FNB Gold"
    │
    ▼
Card dashboard shows:
  • Balance: R12,450.00
  • Limit: R25,000.00
  • Available: R12,550.00
  • Utilisation: 49.8%
  • Due date: 7 May (16 days)
  • Minimum payment: R622.50
    │
    ▼
User taps "Record Payment"
    │
    ▼
Pre-filled form:
  • From account: [FNB Cheque ▼]
  • Amount: R12,450.00 (full balance)
  • Quick options: [Minimum R622.50] [Full R12,450] [Custom]
    │
    ▼
Confirm → Creates:
  1. Transfer OUT from Cheque (-R12,450)
  2. Transfer IN to Credit Card (+R12,450)
  3. Updates credit card balance
  4. Marks as debt payment with interest split
```

### 4.3 Debt Dashboard Overview

```
┌─────────────────────────────────────────┐
│          DEBT OVERVIEW                  │
│                                         │
│  Total Debt: R285,000.00               │
│  Monthly Payments: R8,450.00           │
│  Debt-to-Income: 32%                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ████████░░░░░░░░ 45% paid off   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  LOANS                                  │
│  ┌─────────────────────────────────┐   │
│  │ 🚗 Vehicle Finance      R125,000│   │
│  │    FNB · 11.5% · 36 months left │   │
│  │    ████████████░░░ 62%          │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 🎓 Study Loan            R45,000│   │
│  │    Fundi · 14% · 48 months left │   │
│  │    ████░░░░░░░░░░ 25%          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  CREDIT CARDS                           │
│  ┌─────────────────────────────────┐   │
│  │ 💳 FNB Gold              R12,450│   │
│  │    Limit R25,000 · Due 7 May    │   │
│  │    Utilisation: ████░░ 49.8%    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  STORE CARDS                            │
│  ┌─────────────────────────────────┐   │
│  │ 🛍️ Woolworths Card       R3,200│   │
│  │    22.5% · Due 15 May           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [📊 Payoff Planner]                   │
└─────────────────────────────────────────┘
```

---

## 5. Financial Calculation Engine

### 5.1 Amortisation Schedule

```typescript
// lib/calculations/amortisation.ts
interface AmortisationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  totalInterest: number;
}

function generateAmortisation(
  principal: number,      // in cents
  annualRate: number,      // e.g., 11.5
  termMonths: number,
  extraMonthly: number = 0
): AmortisationRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const basePayment = Math.ceil(
    principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
  
  const schedule: AmortisationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  while (balance > 0 && month < termMonths * 2) { // safety cap
    month++;
    const interest = Math.ceil(balance * monthlyRate);
    const payment = Math.min(basePayment + extraMonthly, balance + interest);
    const principalPaid = payment - interest;
    balance -= principalPaid;
    totalInterest += interest;

    schedule.push({
      month,
      payment,
      principal: principalPaid,
      interest,
      balance: Math.max(0, balance),
      totalInterest,
    });
  }

  return schedule;
}
```

### 5.2 Debt Snowball/Avalanche

```typescript
// lib/calculations/snowball.ts
interface DebtPayoffPlan {
  debt_id: string;
  name: string;
  payoff_date: string;
  total_interest: number;
  total_paid: number;
  months_to_payoff: number;
}

function calculatePayoffPlan(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche' | 'custom',
  extraBudget: number = 0     // Additional monthly amount beyond minimums
): DebtPayoffPlan[] {
  // Sort debts based on strategy
  const sorted = [...debts];
  if (strategy === 'snowball') {
    sorted.sort((a, b) => a.current_balance - b.current_balance);
  } else if (strategy === 'avalanche') {
    sorted.sort((a, b) => b.interest_rate - a.interest_rate);
  } else {
    sorted.sort((a, b) => (a.priority_order ?? 0) - (b.priority_order ?? 0));
  }

  // Simulate month-by-month payoff
  // Extra budget goes to first debt, when paid off, rolls to next
  // ... (full simulation logic)
}
```

### 5.3 Credit Card Interest

```typescript
// lib/calculations/interest.ts
function calculateCreditCardInterest(
  balance: number,           // Current balance in cents
  annualRate: number,         // e.g., 21.75
  paymentAmount: number,      // Monthly payment
  months: number = 120        // Project forward
): { monthsToPayoff: number; totalInterest: number } {
  const monthlyRate = annualRate / 100 / 12;
  let remaining = balance;
  let totalInterest = 0;
  let monthCount = 0;

  while (remaining > 0 && monthCount < months) {
    const interest = Math.ceil(remaining * monthlyRate);
    totalInterest += interest;
    remaining = remaining + interest - paymentAmount;
    monthCount++;
    if (paymentAmount <= interest) break; // Will never pay off
  }

  return { monthsToPayoff: monthCount, totalInterest };
}
```

---

## 6. Development Phases

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** App shell, auth, accounts, and basic transactions working locally.

| Task | Description | Est. |
|------|-------------|------|
| Project setup | Next.js, Tailwind, shadcn/ui, Dexie.js, PWA config | 1 day |
| Auth | Supabase Auth (email/password, Google OAuth) | 1 day |
| Layout shell | Responsive sidebar (desktop) / bottom nav (mobile), header, FAB | 2 days |
| Accounts CRUD | Create, edit, delete, reorder accounts | 2 days |
| Categories | Pre-loaded SA categories, custom category creation | 1 day |
| Transaction CRUD | Full create/edit/delete with all fields | 3 days |
| Quick-Add Sheet | Numpad-first bottom sheet for rapid entry | 2 days |
| Transaction list | Grouped by date, search, filters | 2 days |
| Local DB | Dexie.js schema, indexes, reactive queries | 1 day |
| Currency formatting | ZAR display with dinero.js, cents-based storage | 0.5 day |

**Deliverable:** Working app where you can add accounts, record transactions quickly, and see them in a list. Fully offline.

### Phase 2 — Budgets & Analytics (Weeks 4–5)

| Task | Description | Est. |
|------|-------------|------|
| Budget CRUD | Create budgets with flexible periods and payday alignment | 2 days |
| Budget dashboard | Progress bars, category breakdowns, daily allowance | 2 days |
| Budget history | View and compare past periods | 1 day |
| Category limits | Per-category spending limits within budgets | 1 day |
| Spending charts | Pie chart (by category), bar chart (by period) | 2 days |
| Income vs Expense | Monthly trend line chart | 1 day |
| Heatmap calendar | Daily spending intensity view | 1 day |

**Deliverable:** Full budgeting with visual analytics.

### Phase 3 — Debt Management (Weeks 6–8)

| Task | Description | Est. |
|------|-------------|------|
| Debt entity & CRUD | Add/edit/track loans, credit cards, store cards | 2 days |
| Debt dashboard | Overview with total debt, progress, debt-to-income | 2 days |
| Amortisation engine | Generate and display payment schedules | 2 days |
| Credit card widget | Balance, limit, utilisation, statement tracking | 2 days |
| Payment recording | Link debt payments to transactions with principal/interest split | 2 days |
| Snowball/Avalanche | Payoff strategy planner with visual timeline | 3 days |
| Extra payment calculator | "What if" modelling for extra payments | 1 day |
| Payment reminders | Due date notifications | 1 day |

**Deliverable:** Complete debt management module.

### Phase 4 — Goals, Recurring & Polish (Weeks 9–10)

| Task | Description | Est. |
|------|-------------|------|
| Goals CRUD | Saving and debt payoff goals with progress tracking | 2 days |
| Recurring transactions | Scheduled transactions with auto-creation | 2 days |
| Subscription tracker | Flag and manage subscriptions | 1 day |
| Split transactions | Divide across categories | 1 day |
| Transfers | Account-to-account transfers with paired transactions | 1 day |
| Net worth tracking | Assets minus liabilities over time | 1 day |
| Dark mode | Full theme support | 0.5 day |
| Onboarding flow | First-run wizard: currency, accounts, categories | 1 day |

**Deliverable:** Feature-complete app.

### Phase 5 — Sync & Data (Weeks 11–12)

| Task | Description | Est. |
|------|-------------|------|
| Supabase migrations | Deploy all SQL schemas | 1 day |
| RLS policies | Row Level Security for all tables | 1 day |
| Sync engine | Offline queue, push/pull, conflict resolution | 3 days |
| Real-time subscriptions | Supabase Realtime for multi-device sync | 1 day |
| CSV import | Column mapping UI, data validation | 2 days |
| CSV/Excel export | Transaction and report exports | 1 day |
| Backup/restore | JSON backup download and import | 1 day |

**Deliverable:** Cloud-synced, multi-device capable app.

### Phase 6 — Testing, Optimisation & Launch (Weeks 13–14)

| Task | Description | Est. |
|------|-------------|------|
| Performance audit | IndexedDB query optimisation, bundle size | 2 days |
| PWA testing | Install flow, offline reliability, service worker | 1 day |
| Cross-browser testing | Chrome, Safari, Firefox, Samsung Internet | 1 day |
| Mobile responsiveness | Test on various screen sizes | 1 day |
| Accessibility | Keyboard nav, screen reader, contrast | 1 day |
| Bug fixes & polish | UI refinements, edge cases | 3 days |
| Deploy | Vercel deployment, custom domain, SSL | 0.5 day |

**Deliverable:** Production-ready PWA.

---

## 7. Supabase Configuration

### 7.1 Project Setup Checklist

1. Create Supabase project at supabase.com
2. Enable Email + Google Auth providers
3. Run migration SQL files in order (001–008)
4. Configure RLS policies
5. Set up Realtime on: transactions, accounts, debts, budgets
6. Create storage bucket for receipt attachments
7. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 7.2 Storage Bucket (Receipts)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

CREATE POLICY "Users upload own receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 8. Key Design Principles

**Seamless transaction entry:** The quick-add flow should feel like typing a message — tap, type amount, pick category, done. No unnecessary screens or confirmations.

**ZAR-first:** All amounts displayed as "R 1,234.56" with South African thousand separators. Stored internally as cents (integers) to avoid floating point issues.

**Offline by default:** The app works without internet. Cloud sync is a bonus, not a requirement. Users should never see a loading spinner for their own data.

**Debt visibility:** Most budget apps hide debt in account balances. RandTracker makes debt a first-class citizen with its own dashboard, calculations, and planning tools.

**Progressive disclosure:** Start simple (accounts + transactions + budget), reveal complexity (debt planner, goals, analytics) as users need it. Cashew does this brilliantly.

**Dark mode from day one:** South Africans deal with load shedding — dark mode saves battery on OLED screens.

---

## 9. Future Enhancements (Post-MVP)

These are out of scope for the initial build but worth planning for:

- **Bank statement import** (PDF parsing for FNB, Capitec, Standard Bank formats)
- **Flutter mobile app** sharing the Supabase backend
- **Multi-currency support** with live exchange rates (for USD investments)
- **Shared budgets** for couples/families
- **AI categorisation** — auto-categorise transactions based on merchant/description
- **Widget** — home screen widget showing today's spending and remaining budget
- **Vault22/bank linking** via API if available
- **Tax report generation** — categorised income/expenses for SARS submission
- **WhatsApp bot** — log transactions via WhatsApp message

---

## 10. Development Environment Setup

```bash
# Create the project
npx create-next-app@latest randtracker --typescript --tailwind --app --src-dir
cd randtracker

# Install core dependencies
npm install @supabase/supabase-js dexie dexie-react-hooks zustand recharts date-fns dinero.js uuid

# Install UI
npx shadcn@latest init
npx shadcn@latest add button card dialog drawer input label select tabs toast sheet progress badge

# Install dev dependencies
npm install -D @types/uuid

# PWA support
npm install next-pwa
```

---

*This document serves as both a product specification and technical blueprint. Each phase builds on the previous one, and the app is usable from the end of Phase 1 onwards. The architecture supports a gradual evolution from a local-only PWA to a fully cloud-synced, multi-device application.*
