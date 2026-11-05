# Fix for RLS Policy Violation

## Error Message
```
{
    "code": "42501",
    "details": null,
    "hint": null,
    "message": "new row violates row-level security policy for table \"investment_transactions\""
}
```

## Root Cause

The `user_id` being inserted doesn't match the authenticated Supabase user (`auth.uid()`). This happens when:

1. The user state in `useUserStore` doesn't match the Supabase auth session
2. The user logged in but the auth session wasn't properly established
3. The auth token expired

## Solution

### Step 1: Apply the RLS Fix Migration

Go to your Supabase Dashboard > SQL Editor and run this migration:

```sql
-- File: 006_fix_investment_transactions_rls.sql

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can create own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can update own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can delete own investment transactions" ON investment_transactions;

-- Recreate policies with proper checks
CREATE POLICY "Users can view own investment transactions"
    ON investment_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment transactions"
    ON investment_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment transactions"
    ON investment_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment transactions"
    ON investment_transactions FOR DELETE
    USING (auth.uid() = user_id);
```

### Step 2: Debug the Auth Session

Open your browser console and run:

```javascript
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// Check current auth session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User ID from session:', session?.user?.id);

// Check user store
import { useUserStore } from '@/stores/userStore';
const userStoreUser = useUserStore.getState().user;
console.log('User from store:', userStoreUser);
console.log('User ID from store:', userStoreUser?.id);

// These should match!
console.log('IDs match:', session?.user?.id === userStoreUser?.id);
```

### Step 3: Log Out and Log Back In

The most reliable fix:

1. **Log out**: Click your profile > Sign Out
2. **Clear browser data**:
   - Open DevTools (F12)
   - Application tab > Storage > Clear site data
3. **Refresh page**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
4. **Log back in**: Use your credentials
5. **Try again**: Create an investment transaction

### Step 4: Test the Fix

Run this in Supabase SQL Editor to verify auth is working:

```sql
-- This will show your current auth user
SELECT auth.uid() as current_auth_user;

-- This will show if you can insert (returns true/false)
SELECT auth.uid() IS NOT NULL as can_insert_transactions;
```

### Step 5: Verify User Profile Exists

```sql
-- Check if your user profile exists
SELECT * FROM user_profiles WHERE id = auth.uid();

-- If empty, create it:
INSERT INTO user_profiles (id, email, currency)
VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'ZAR'
);
```

## Prevention

To prevent this issue in the future:

1. **Always use the Supabase auth user**: Don't rely solely on `useUserStore`
2. **Refresh sessions regularly**: Implement session refresh logic
3. **Handle auth state properly**: Ensure AuthContext and UserStore are synced

## Alternative: Bypass RLS for Testing (Development Only!)

**⚠️ WARNING: Only use this for local development testing!**

```sql
-- Temporarily disable RLS on investment_transactions
ALTER TABLE investment_transactions DISABLE ROW LEVEL SECURITY;

-- Test your inserts

-- Re-enable RLS when done
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
```

**Never disable RLS in production!**

## Still Not Working?

If the issue persists:

1. **Check Supabase logs**:
   - Go to Supabase Dashboard > Logs
   - Look for failed INSERT attempts
   - Note the user_id being sent vs auth.uid()

2. **Verify the auth context**:
   ```typescript
   // In your component
   import { useAuth } from '@/contexts/AuthContext';

   const { user: authUser } = useAuth();
   console.log('Auth user:', authUser);
   ```

3. **Check environment variables**:
   - Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
   - Restart dev server after changing `.env.local`

4. **Recreate the user profile**:
   ```sql
   -- Delete and recreate
   DELETE FROM user_profiles WHERE id = auth.uid();

   INSERT INTO user_profiles (id, email, currency)
   VALUES (
       auth.uid(),
       (SELECT email FROM auth.users WHERE id = auth.uid()),
       'ZAR'
   );
   ```

---

## Quick Checklist

- [ ] Migration 006 applied in Supabase
- [ ] Logged out and back in
- [ ] Browser cache cleared
- [ ] Auth session verified (IDs match)
- [ ] User profile exists in database
- [ ] RLS policies active (shown in Supabase Dashboard)
- [ ] Environment variables set correctly

Once all checkboxes are complete, the RLS error should be resolved!
