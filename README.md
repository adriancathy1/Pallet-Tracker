# Pallet Tracker (static)

This repository contains a small single-page application to record pallet issue/return movements in the browser. It uses localStorage for offline-first operation and includes placeholders for Supabase sync.

Quick start (local):

1. Open [index.html](index.html) in Chrome or Safari on your machine.
2. Use the UI to add staff and record movements.

Supabase setup (optional, for cross-device sync)

1. Sign up at https://app.supabase.com and create a new project.
2. In the SQL editor, create tables matching the following schema (example):

```sql
-- movements
create table movements (
  id bigint primary key,
  date date,
  recorded_at timestamptz,
  edited_at timestamptz,
  customer text,
  type text,
  qty integer,
  staff text,
  note text
);

-- staff
create table staff (
  name text primary key
);

-- customers
create table customers (
  name text primary key
);

-- audit
create table audit (
  id bigserial primary key,
  op text,
  obj_id bigint,
  payload jsonb,
  at timestamptz default now()
);
```

3. Go to Project Settings → API and copy the `URL` and `anon` key.
4. To enable client-side writes, configure Row Level Security (RLS) policies or use a service key from a trusted server. For simple testing, you can temporarily disable RLS.
5. Populate `app.js` constants `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your values and implement the sync calls where indicated.

Notes & decisions made in the scaffold

- The app is implemented using plain HTML/CSS/vanilla JS and stores data in localStorage by default.
- Customer and staff names are deduplicated case-insensitively.
- Returns that would create a negative balance are blocked (user choice).
- Deletes are permanent but recorded in a local audit array; there is an `Undo Last` action to revert the most recent create/edit/delete/customer-rename action.
- CSV export is implemented for movements (filtered view respected).

Next steps I can take now

- Integrate Supabase synchronization once you provide the `SUPABASE_URL` and `anon` key (or I can leave placeholders and instructions).
- Add inline editing UI for movement rows, richer audit timeline, or soft-delete/trash with a recovery UI.
# Pallet-Tracker