

## Problem

The `user_roles` table contains no rows with `role = 'admin'`. The `handle_new_user_role` trigger inserts `'user'` role on signup, but nobody was ever assigned `'admin'`.

## Fix

Run a single database migration to insert the admin role for the correct user(s).

### Migration SQL

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<chosen_user_id>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Once the user confirms which email should be admin, I'll run this migration. No code changes needed — `PlanContext` already checks `has_role(auth.uid(), 'admin')` and the admin page gates on `isAdmin`.

