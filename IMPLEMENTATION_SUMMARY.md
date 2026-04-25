# RandTracker Implementation Summary

## Overview

RandTracker is set up as a Next.js application with Supabase-backed authentication and persistence, Zustand state management, and finance-specific utilities for the South African market.

## Implemented Foundations

- Next.js app structure with dashboard routes
- TypeScript data models in `src/lib/db/schema.ts`
- Financial calculation helpers in `src/lib/calculations/`
- ZAR formatting utilities in `src/lib/currency.ts`
- Auth flow via Supabase
- Client-side stores wired to Supabase data operations
- Responsive dashboard layout and core UI components

## Current Persistence Model

- User profiles are stored in Supabase
- Accounts are stored in Supabase
- Categories and subcategories are stored in Supabase
- Transactions are stored in Supabase
- Local Dexie/IndexedDB persistence has been removed from the active app flow

## Key Files

- `src/lib/supabase/client.ts`
- `src/lib/supabase/data.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/auth/AuthSessionBridge.tsx`
- `src/stores/accountStore.ts`
- `src/stores/categoryStore.ts`
- `src/stores/transactionStore.ts`
- `src/stores/userStore.ts`

## Setup Requirements

- Configure `NEXT_PUBLIC_SUPABASE_URL`
- Configure `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Apply the SQL migrations in `supabase/migrations/`

## Status

- Core dashboard app is implemented
- Supabase-backed data flow is implemented
- Legacy local-first persistence docs are no longer accurate and have been replaced
